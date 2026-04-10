import { BrowserWindow } from 'electron'
import { sshService } from './ssh.service'
import { serverFilesPath } from './screen.service'
import { getServer, upsertServer } from '../store/store'
import { IPC } from '../../shared/types'
import type { InstallStep } from '../../shared/types'

const DEFAULT_DOWNLOAD_URL =
  'https://downloads.gtnewhorizons.com/ServerPacks/GT_New_Horizons_2.8.1_Server_Java_17-25.zip'

function buildSteps(): InstallStep[] {
  return [
    { id: 'apt-update', label: 'Update package lists', status: 'pending' },
    { id: 'apt-upgrade', label: 'Upgrade packages', status: 'pending' },
    { id: 'install-java', label: 'Install Java 21, unzip & screen', status: 'pending' },
    { id: 'mkdir', label: 'Create server directory', status: 'pending' },
    { id: 'download', label: 'Download GTNH server zip', status: 'pending' },
    { id: 'unzip', label: 'Unzip server files', status: 'pending' },
    { id: 'chmod', label: 'Set script permissions', status: 'pending' },
    { id: 'eula', label: 'Accept EULA', status: 'pending' },
  ]
}

// Commands that require sudo
const SUDO_COMMANDS = new Set(['apt-update', 'apt-upgrade', 'install-java'])

function getCommand(stepId: string, filesPath: string, downloadUrl: string, sudoPrefix: string): string {
  const s = sudoPrefix
  const commands: Record<string, string> = {
    'apt-update': `${s}apt update`,
    'apt-upgrade': `${s}DEBIAN_FRONTEND=noninteractive apt upgrade -y`,
    'install-java': `${s}apt install -y openjdk-21-jre-headless unzip screen`,
    'mkdir': `mkdir -p ${filesPath}`,
    'download': `wget -q -O /tmp/gtnh-server.zip "${downloadUrl}"`,
    'unzip': `unzip -o /tmp/gtnh-server.zip -d ${filesPath}`,
    'chmod': `chmod +x ${filesPath}/startserver-java9.sh`,
    'eula': `echo "eula=true" > ${filesPath}/eula.txt`,
  }
  return commands[stepId] ?? ''
}

export async function runInstall(
  serverId: string,
  win: BrowserWindow,
  downloadUrl?: string,
  sudoPassword?: string
): Promise<void> {
  const config = getServer(serverId)
  if (!config) throw new Error(`Server ${serverId} not found`)

  const url = downloadUrl ?? DEFAULT_DOWNLOAD_URL
  const filesPath = serverFilesPath(config.installPath)

  // Build sudo prefix:
  // - If sudoPassword provided: pipe it via echo to sudo -S
  // - If no password: use plain sudo (works when running as root or with NOPASSWD)
  const sudoPrefix = sudoPassword
    ? `echo ${shellEscape(sudoPassword)} | sudo -S `
    : 'sudo '

  const steps = buildSteps()

  // Notify renderer of initial step list
  for (const step of steps) {
    win.webContents.send(IPC.INSTALL_PROGRESS, step)
  }

  for (const step of steps) {
    const running: InstallStep = { ...step, status: 'running', output: '' }
    win.webContents.send(IPC.INSTALL_PROGRESS, running)

    const command = getCommand(step.id, filesPath, url, sudoPrefix)
    const result = await sshService.executeCommand(serverId, command)

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

  // Mark server as installed
  const updated = { ...config, isInstalled: true, updatedAt: new Date().toISOString() }
  upsertServer(updated)
}

/** Wrap a string in single quotes and escape any single quotes inside it */
function shellEscape(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`
}
