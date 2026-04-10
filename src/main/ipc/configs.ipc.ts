import { ipcMain } from 'electron'
import { IPC } from '../../shared/types'
import type { ConfigDirEntry } from '../../shared/types'
import { sshService } from '../services/ssh.service'
import { serverFilesPath } from '../services/screen.service'
import { getServer } from '../store/store'

export function registerConfigsHandlers() {
  ipcMain.handle(IPC.CONFIGS_LIST_DIR, async (_event, serverId: string, relPath: string) => {
    const config = getServer(serverId)
    if (!config) throw new Error(`Server ${serverId} not found`)

    const base = serverFilesPath(config.installPath)
    const dir = relPath ? `${base}/${relPath}` : base

    // ls -1p appends '/' to directory names so we can distinguish them
    const result = await sshService.executeCommand(serverId, `ls -1p "${dir}" 2>/dev/null`)

    const entries: ConfigDirEntry[] = result.stdout
      .split('\n')
      .filter(Boolean)
      .map((entry) => ({
        name: entry.endsWith('/') ? entry.slice(0, -1) : entry,
        isDir: entry.endsWith('/'),
      }))

    return entries
  })

  ipcMain.handle(IPC.CONFIGS_READ, async (_event, serverId: string, relPath: string) => {
    const config = getServer(serverId)
    if (!config) throw new Error(`Server ${serverId} not found`)

    const fullPath = `${serverFilesPath(config.installPath)}/${relPath}`
    return sshService.downloadText(serverId, fullPath)
  })

  ipcMain.handle(IPC.CONFIGS_WRITE, async (_event, serverId: string, relPath: string, content: string) => {
    const config = getServer(serverId)
    if (!config) throw new Error(`Server ${serverId} not found`)

    const fullPath = `${serverFilesPath(config.installPath)}/${relPath}`
    await sshService.uploadText(serverId, fullPath, content)
  })
}
