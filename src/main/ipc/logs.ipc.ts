import { ipcMain, BrowserWindow } from 'electron'
import { NodeSSH } from 'node-ssh'
import { IPC } from '../../shared/types'
import type { LogChunk, SshLogEntry } from '../../shared/types'
import { sshService, sshEvents } from '../services/ssh.service'
import { SCREEN_SESSION, SCREEN_LOG } from '../services/screen.service'
import { getServer } from '../store/store'

// Each server gets its own dedicated SSH connection for log tailing.
// Kept separate from the main sshService pool so that stopping/restarting
// log streams never disrupts status checks, start/stop, or settings operations.
const logConnections = new Map<string, NodeSSH>()

export function disposeAllLogConnections() {
  for (const [id, ssh] of logConnections.entries()) {
    logConnections.delete(id)
    try { ssh.dispose() } catch { /* ignore */ }
  }
}

export function registerLogsHandlers(win: BrowserWindow) {
  // Forward every SSH command completion to the renderer
  sshEvents.on('command', (entry: SshLogEntry) => {
    if (!win.isDestroyed()) {
      win.webContents.send(IPC.SSH_LOG, entry.serverId, entry)
    }
  })

  ipcMain.handle(IPC.LOGS_START, async (_event, serverId: string) => {
    // If a stream is already active for this server, do nothing
    if (logConnections.has(serverId)) return

    if (!getServer(serverId)) throw new Error(`Server ${serverId} not found`)

    // Open a dedicated connection for this stream
    let ssh: NodeSSH
    try {
      ssh = await sshService.connectRaw(serverId)
    } catch (err) {
      throw new Error(`Could not open log connection: ${err instanceof Error ? err.message : err}`)
    }
    logConnections.set(serverId, ssh)

    // Enable screen session logging in case the server was started without -L,
    // then follow the log file from the beginning (-n +1).
    // tail -F (capital F) retries if the file doesn't exist yet.
    const cmd = [
      `screen -S ${SCREEN_SESSION} -X logfile ${SCREEN_LOG} 2>/dev/null`,
      `screen -S ${SCREEN_SESSION} -X log on 2>/dev/null`,
      `tail -n +1 -F ${SCREEN_LOG} 2>/dev/null`,
    ].join('; ')

    ssh.execCommand(cmd, {
      onStdout: (chunk) => {
        if (!logConnections.has(serverId)) return
        const data = chunk.toString()
        if (!data) return
        const logChunk: LogChunk = { type: 'stdout', data, timestamp: new Date().toISOString() }
        win.webContents.send(IPC.LOGS_CHUNK, serverId, logChunk)
      },
      onStderr: (chunk) => {
        if (!logConnections.has(serverId)) return
        const data = chunk.toString()
        if (!data) return
        const logChunk: LogChunk = { type: 'stderr', data, timestamp: new Date().toISOString() }
        win.webContents.send(IPC.LOGS_CHUNK, serverId, logChunk)
      },
    }).finally(() => {
      logConnections.delete(serverId)
    })
  })

  ipcMain.handle(IPC.LOGS_STOP, async (_event, serverId: string) => {
    const ssh = logConnections.get(serverId)
    if (ssh) {
      logConnections.delete(serverId)
      try { ssh.dispose() } catch { /* ignore */ }
    }
  })
}
