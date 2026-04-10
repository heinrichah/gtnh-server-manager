import { BrowserWindow } from 'electron'
import { sshService } from './ssh.service'
import { serverFilesPath } from './screen.service'
import { getServer, upsertServer } from '../store/store'
import { IPC } from '../../shared/types'
import type { InstallStep } from '../../shared/types'
import { applyDropinMods } from './modsDropin.service'

// Web UI URL: https://github.com/owner/repo/actions/runs/RUN_ID/artifacts/ARTIFACT_ID
const GITHUB_WEB_ARTIFACT_RE = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/actions\/runs\/\d+\/artifacts\/(\d+)/
// API URL: https://api.github.com/repos/owner/repo/actions/artifacts/ARTIFACT_ID/zip
const GITHUB_API_ARTIFACT_RE = /^https:\/\/api\.github\.com\/repos\/[^/]+\/[^/]+\/actions\/artifacts\/\d+\/zip/

function isGithubArtifactUrl(url: string): boolean {
  return GITHUB_WEB_ARTIFACT_RE.test(url) || GITHUB_API_ARTIFACT_RE.test(url)
}

function shellEscape(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`
}

function buildGithubCurlCommand(apiUrl: string, token: string): string {
  return [
    'curl -fL --progress-bar',
    `-H ${shellEscape('Accept: application/vnd.github+json')}`,
    `-H ${shellEscape(`Authorization: Bearer ${token}`)}`,
    `-H ${shellEscape('X-GitHub-Api-Version: 2022-11-28')}`,
    `-o /tmp/gtnh-update.zip`,
    shellEscape(apiUrl),
  ].join(' ')
}

function buildDownloadCommand(url: string, token: string | undefined): string {
  if (token) {
    const webMatch = url.match(GITHUB_WEB_ARTIFACT_RE)
    if (webMatch) {
      const [, owner, repo, artifactId] = webMatch
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/actions/artifacts/${artifactId}/zip`
      return buildGithubCurlCommand(apiUrl, token)
    }
    if (GITHUB_API_ARTIFACT_RE.test(url)) {
      return buildGithubCurlCommand(url, token)
    }
  }
  return `wget -O /tmp/gtnh-update.zip ${shellEscape(url)}`
}

function buildUnzipCommand(isGithubArtifact: boolean): string {
  if (isGithubArtifact) {
    return (
      `rm -rf /tmp/gtnh-outer && mkdir -p /tmp/gtnh-outer && ` +
      `unzip -o /tmp/gtnh-update.zip -d /tmp/gtnh-outer && ` +
      `rm -rf /tmp/gtnh-update && mkdir -p /tmp/gtnh-update && ` +
      `unzip -o /tmp/gtnh-outer/*.zip -d /tmp/gtnh-update && ` +
      `chmod -R 777 /tmp/gtnh-update`
    )
  }
  return `rm -rf /tmp/gtnh-update && mkdir -p /tmp/gtnh-update && unzip -o /tmp/gtnh-update.zip -d /tmp/gtnh-update && chmod -R 777 /tmp/gtnh-update`
}

export function buildUpdateSteps(): InstallStep[] {
  return [
    { id: 'backup', label: 'Back up server files', status: 'pending' },
    { id: 'clean', label: 'Remove old mod files', status: 'pending' },
    { id: 'download', label: 'Download new version', status: 'pending' },
    { id: 'unzip', label: 'Extract archive', status: 'pending' },
    { id: 'apply', label: 'Apply new files', status: 'pending' },
    { id: 'restore-journeymap', label: 'Restore JourneyMap config', status: 'pending' },
    { id: 'chmod', label: 'Set permissions', status: 'pending' },
    { id: 'dropin-mods', label: 'Apply drop-in mods', status: 'pending' },
    { id: 'cleanup', label: 'Clean up temp files', status: 'pending' },
  ]
}

function getUpdateCommand(
  stepId: string,
  filesPath: string,
  backupPath: string,
  downloadUrl: string,
  token: string | undefined
): string {
  const isGithub = isGithubArtifactUrl(downloadUrl)
  const commands: Record<string, string> = {
    'backup': `cp -r ${filesPath} ${backupPath}`,
    'clean': `cd ${filesPath} && rm -rf config libraries mods resources scripts && rm -f startserver.sh startserver-java9.sh startserver-java9.bat java9args.txt lwjgl3ify-forgePatches.jar`,
    'download': buildDownloadCommand(downloadUrl, token),
    'unzip': buildUnzipCommand(isGithub),
    'apply': [
      `for dir in config libraries mods resources scripts; do`,
      `  [ -d /tmp/gtnh-update/$dir ] && cp -r /tmp/gtnh-update/$dir ${filesPath}/;`,
      `done;`,
      `for f in startserver.sh startserver-java9.sh startserver-java9.bat java9args.txt lwjgl3ify-forgePatches.jar; do`,
      `  [ -f /tmp/gtnh-update/$f ] && cp /tmp/gtnh-update/$f ${filesPath}/;`,
      `done`,
    ].join(' '),
    'restore-journeymap': `[ -d ${shellEscape(`${backupPath}/config/JourneyMapServer`)} ] && cp -r ${shellEscape(`${backupPath}/config/JourneyMapServer`)} ${shellEscape(`${filesPath}/config/`)} || echo "JourneyMapServer config not found in backup, skipped"`,
    'chmod': `chmod -R 777 ${filesPath}`,
    'cleanup': `rm -rf /tmp/gtnh-update /tmp/gtnh-update.zip /tmp/gtnh-outer`,
  }
  return commands[stepId] ?? ''
}

export async function runUpdate(
  serverId: string,
  win: BrowserWindow,
  downloadUrl: string,
  artifactName?: string
): Promise<void> {
  const config = getServer(serverId)
  if (!config) throw new Error(`Server ${serverId} not found`)

  const filesPath = serverFilesPath(config.installPath)
  const datetime = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const backupPath = `${filesPath}-backup_${datetime}`

  const steps = buildUpdateSteps()

  // Notify renderer of initial step list
  for (const step of steps) {
    win.webContents.send(IPC.UPDATE_PROGRESS, step)
  }

  for (const step of steps) {
    const running: InstallStep = { ...step, status: 'running', output: '' }
    win.webContents.send(IPC.UPDATE_PROGRESS, running)

    if (step.id === 'dropin-mods') {
      try {
        const output = await applyDropinMods(serverId, filesPath)
        win.webContents.send(IPC.UPDATE_PROGRESS, { ...step, status: 'success', output })
      } catch (err) {
        win.webContents.send(IPC.UPDATE_PROGRESS, { ...step, status: 'error', output: String(err instanceof Error ? err.message : err) })
        throw err
      }
      continue
    }

    const command = getUpdateCommand(step.id, filesPath, backupPath, downloadUrl, config.githubToken)

    let result
    if (step.id === 'download') {
      let liveOutput = ''
      result = await sshService.executeCommandStreaming(serverId, command, (data) => {
        liveOutput += data
        win.webContents.send(IPC.UPDATE_PROGRESS, { ...running, output: liveOutput })
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
    win.webContents.send(IPC.UPDATE_PROGRESS, done)

    if (result.code !== 0) {
      throw new Error(`Step "${step.label}" failed: ${result.stderr}`)
    }
  }

  // Record the new version
  const versionLabel = artifactName ?? urlToVersionLabel(downloadUrl)
  const updated = { ...config, installedVersion: versionLabel, updatedAt: new Date().toISOString() }
  upsertServer(updated)
}

function urlToVersionLabel(url: string): string {
  try {
    const filename = new URL(url).pathname.split('/').pop() ?? url
    return filename.replace(/\.zip$/i, '')
  } catch {
    return url
  }
}
