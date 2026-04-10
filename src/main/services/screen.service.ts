import { sshService } from './ssh.service'
import { getServer } from '../store/store'

type ServerStatus = 'running' | 'stopped' | 'unknown'

/** The screen session name used for all GTNH server instances. Single source of truth. */
export const SCREEN_SESSION = 'MC'

/** Remote path where screen logs the session output. Cleared on each server start. */
export const SCREEN_LOG = '/tmp/gtnh-screen.log'

/** The subdirectory within installPath where actual server files live. */
export function serverFilesPath(installPath: string): string {
  return `${installPath}/server-files`
}

/**
 * Detect server status by checking whether a screen session named SCREEN_SESSION exists.
 * Outputs exactly "running" or "stopped" so parsing is unambiguous.
 */
async function getStatus(serverId: string): Promise<ServerStatus> {
  try {
    const result = await sshService.executeCommand(
      serverId,
      `screen -ls 2>/dev/null | grep -q "\\.${SCREEN_SESSION}" && echo running || echo stopped`
    )
    const out = result.stdout.trim()
    if (out === 'running') return 'running'
    if (out === 'stopped') return 'stopped'
    return 'unknown'
  } catch {
    return 'unknown'
  }
}

async function startServer(serverId: string): Promise<void> {
  const config = getServer(serverId)
  if (!config) throw new Error(`Server ${serverId} not found`)

  const filesPath = serverFilesPath(config.installPath)
  const result = await sshService.executeCommand(
    serverId,
    `rm -f ${SCREEN_LOG} && cd ${filesPath} && screen -L -Logfile ${SCREEN_LOG} -dmS ${SCREEN_SESSION} ./startserver-java9.sh`
  )
  if (result.code !== 0) {
    throw new Error(`Failed to start server: ${result.stderr || result.stdout}`)
  }
}

async function stopServer(serverId: string): Promise<void> {
  const current = await getStatus(serverId)
  if (current === 'stopped') return

  // Use printf to emit a real carriage-return — works in dash/sh/bash (unlike $'\r' which is bash-only)
  const sendStop = await sshService.executeCommand(
    serverId,
    `screen -S ${SCREEN_SESSION} -X stuff "$(printf '/stop\r')"`
  )
  if (sendStop.code !== 0) {
    throw new Error(`Failed to send stop command: ${sendStop.stderr}`)
  }

  // Poll until the screen session disappears (up to 120 seconds).
  // If the startup script's reboot countdown appears, send Ctrl-C to abort it.
  const maxWait = 120_000
  const pollInterval = 2_000
  const deadline = Date.now() + maxWait
  let ctrlCSent = false

  while (Date.now() < deadline) {
    await sleep(pollInterval)
    if (await getStatus(serverId) === 'stopped') return

    // Check for the reboot countdown produced by startserver-java9.sh
    if (!ctrlCSent) {
      const tail = await sshService.executeCommand(
        serverId,
        `tail -n 20 ${SCREEN_LOG} 2>/dev/null`
      )
      if (tail.stdout.includes('Rebooting in:')) {
        // Send Ctrl-C to the screen session to abort the restart
        await sshService.executeCommand(
          serverId,
          `screen -S ${SCREEN_SESSION} -X stuff "$(printf '\\003')"`
        )
        ctrlCSent = true
      }
    }
  }

  // Force-kill if graceful stop timed out
  await sshService.executeCommand(serverId, `screen -S ${SCREEN_SESSION} -X quit`)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const screenService = {
  getStatus,
  startServer,
  stopServer,
}
