import { BrowserWindow } from 'electron'
import { sshService } from './ssh.service'
import { serverFilesPath } from './screen.service'
import { getServer, upsertServer } from '../store/store'
import { IPC } from '../../shared/types'
import type { InstallStep } from '../../shared/types'
import { applyDropinMods } from './modsDropin.service'

const DEFAULT_DOWNLOAD_URL =
  'https://downloads.gtnewhorizons.com/ServerPacks/GT_New_Horizons_2.8.1_Server_Java_17-25.zip'

const ADOPTIUM_REPO_CMD =
  'apt-get install -y gnupg wget && ' +
  'wget -qO - https://packages.adoptium.net/artifactory/api/gpg/key/public | gpg --batch --yes --dearmor -o /etc/apt/trusted.gpg.d/adoptium.gpg && ' +
  '. /etc/os-release && ' +
  'echo "deb https://packages.adoptium.net/artifactory/deb $VERSION_CODENAME main" | tee /etc/apt/sources.list.d/adoptium.list && ' +
  'apt-get update -q'

function buildSteps(): InstallStep[] {
  return [
    { id: 'apt-update', label: 'Update package lists', status: 'pending' },
    { id: 'apt-upgrade', label: 'Upgrade packages', status: 'pending' },
    { id: 'setup-java-repo', label: 'Add Adoptium repository', status: 'pending' },
    { id: 'install-java', label: 'Install Temurin 21 JRE, unzip & screen', status: 'pending' },
    { id: 'mkdir', label: 'Clear & create server directory', status: 'pending' },
    { id: 'download', label: 'Download GTNH server zip', status: 'pending' },
    { id: 'unzip', label: 'Unzip server files', status: 'pending' },
    { id: 'chmod', label: 'Set script permissions', status: 'pending' },
    { id: 'dropin-mods', label: 'Apply drop-in mods', status: 'pending' },
    { id: 'eula', label: 'Accept EULA', status: 'pending' },
  ]
}

function buildPrivilege(osType: 'ubuntu' | 'debian', password: string | undefined): (cmd: string) => string {
  if (!password) return (cmd) => cmd
  if (osType === 'ubuntu') return (cmd) => `echo ${shellEscape(password)} | sudo -S ${cmd}`
  // Debian: use su - to run as root
  return (cmd) => `echo ${shellEscape(password)} | su - -c ${shellEscape(cmd)}`
}

// Web UI URL: https://github.com/owner/repo/actions/runs/RUN_ID/artifacts/ARTIFACT_ID
const GITHUB_WEB_ARTIFACT_RE = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/actions\/runs\/\d+\/artifacts\/(\d+)/
// API URL: https://api.github.com/repos/owner/repo/actions/artifacts/ARTIFACT_ID/zip
const GITHUB_API_ARTIFACT_RE = /^https:\/\/api\.github\.com\/repos\/[^/]+\/[^/]+\/actions\/artifacts\/\d+\/zip/

function isGithubArtifactUrl(url: string): boolean {
  return GITHUB_WEB_ARTIFACT_RE.test(url) || GITHUB_API_ARTIFACT_RE.test(url)
}

function buildGithubCurlCommand(apiUrl: string, token: string): string {
  return [
    'curl -fL --progress-bar',
    `-H ${shellEscape('Accept: application/vnd.github+json')}`,
    `-H ${shellEscape(`Authorization: Bearer ${token}`)}`,
    `-H ${shellEscape('X-GitHub-Api-Version: 2022-11-28')}`,
    `-o /tmp/gtnh-server.zip`,
    shellEscape(apiUrl),
  ].join(' ')
}

function buildDownloadCommand(url: string, token: string | undefined): string {
  if (token) {
    // Web UI URL — convert to API URL
    const webMatch = url.match(GITHUB_WEB_ARTIFACT_RE)
    if (webMatch) {
      const [, owner, repo, artifactId] = webMatch
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/actions/artifacts/${artifactId}/zip`
      return buildGithubCurlCommand(apiUrl, token)
    }
    // Already an API artifact URL — use directly
    if (GITHUB_API_ARTIFACT_RE.test(url)) {
      return buildGithubCurlCommand(url, token)
    }
  }
  return `wget -O /tmp/gtnh-server.zip ${shellEscape(url)}`
}

function buildUnzipCommand(filesPath: string, isGithubArtifact: boolean): string {
  if (isGithubArtifact) {
    // GitHub artifact zips contain a single inner zip — unzip outer, then inner
    return (
      `rm -rf /tmp/gtnh-outer && mkdir -p /tmp/gtnh-outer && ` +
      `unzip -o /tmp/gtnh-server.zip -d /tmp/gtnh-outer && ` +
      `unzip -o /tmp/gtnh-outer/*.zip -d ${filesPath}`
    )
  }
  return `unzip -o /tmp/gtnh-server.zip -d ${filesPath}`
}

function getCommand(stepId: string, filesPath: string, downloadUrl: string, token: string | undefined, priv: (cmd: string) => string): string {
  const isGithubArtifact = isGithubArtifactUrl(downloadUrl)
  const commands: Record<string, string> = {
    'apt-update': priv('apt-get update'),
    'apt-upgrade': priv('DEBIAN_FRONTEND=noninteractive apt-get upgrade -y'),
    'setup-java-repo': priv(`sh -c ${shellEscape(ADOPTIUM_REPO_CMD)}`),
    'install-java': priv('apt-get install -y temurin-21-jre unzip screen'),
    'mkdir': `chmod -R 777 ${filesPath} 2>/dev/null; rm -rf ${filesPath} && mkdir -p ${filesPath}`,
    'download': buildDownloadCommand(downloadUrl, token),
    'unzip': buildUnzipCommand(filesPath, isGithubArtifact),
    'chmod': `chmod -R 777 ${filesPath}`,
    'eula': `echo "eula=true" > ${filesPath}/eula.txt`,
  }
  return commands[stepId] ?? ''
}

export async function runInstall(
  serverId: string,
  win: BrowserWindow,
  downloadUrl?: string,
  sudoPassword?: string,
  skipUpdates?: boolean,
  artifactName?: string
): Promise<void> {
  const config = getServer(serverId)
  if (!config) throw new Error(`Server ${serverId} not found`)

  const url = downloadUrl ?? DEFAULT_DOWNLOAD_URL
  const filesPath = serverFilesPath(config.installPath)
  const priv = buildPrivilege(config.osType ?? 'ubuntu', sudoPassword || undefined)

  const steps = buildSteps()

  // Notify renderer of initial step list
  for (const step of steps) {
    win.webContents.send(IPC.INSTALL_PROGRESS, step)
  }

  const SKIP_IDS = new Set(skipUpdates ? ['apt-update', 'apt-upgrade', 'setup-java-repo', 'install-java'] : [])

  for (const step of steps) {
    if (SKIP_IDS.has(step.id)) {
      win.webContents.send(IPC.INSTALL_PROGRESS, { ...step, status: 'success', output: 'Skipped' })
      continue
    }

    const running: InstallStep = { ...step, status: 'running', output: '' }
    win.webContents.send(IPC.INSTALL_PROGRESS, running)

    if (step.id === 'dropin-mods') {
      try {
        const output = await applyDropinMods(serverId, filesPath)
        win.webContents.send(IPC.INSTALL_PROGRESS, { ...step, status: 'success', output })
      } catch (err) {
        win.webContents.send(IPC.INSTALL_PROGRESS, { ...step, status: 'error', output: String(err instanceof Error ? err.message : err) })
        throw err
      }
      continue
    }

    const command = getCommand(step.id, filesPath, url, config.githubToken, priv)

    let result
    if (step.id === 'download') {
      let liveOutput = ''
      result = await sshService.executeCommandStreaming(serverId, command, (data) => {
        liveOutput += data
        win.webContents.send(IPC.INSTALL_PROGRESS, { ...running, output: liveOutput })
      })
      result = { ...result, stdout: liveOutput, stderr: '' }
    } else {
      result = await sshService.executeCommand(serverId, command)
    }

    const done: InstallStep = {
      ...step,
      status: result.code === 0 ? 'success' : 'error',
      output: [result.stdout, result.stderr].filter(Boolean).join('\n'),
    }
    win.webContents.send(IPC.INSTALL_PROGRESS, done)

    if (result.code !== 0) {
      throw new Error(`Step "${step.label}" failed: ${result.stderr}`)
    }
  }

  // Mark server as installed and record the version
  const versionLabel = artifactName ?? urlToVersionLabel(url)
  const updated = { ...config, isInstalled: true, installedVersion: versionLabel, updatedAt: new Date().toISOString() }
  upsertServer(updated)
}

/** Wrap a string in single quotes and escape any single quotes inside it */
function shellEscape(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`
}

/** Derive a human-readable version label from a download URL when no artifact name is available */
function urlToVersionLabel(url: string): string {
  try {
    const filename = new URL(url).pathname.split('/').pop() ?? url
    return filename.replace(/\.zip$/i, '')
  } catch {
    return url
  }
}
