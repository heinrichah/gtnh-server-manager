import { ipcMain } from 'electron'
import { IPC } from '../../shared/types'
import type { ServerSettings } from '../../shared/types'
import { readSettings, persistSettings, readWhitelist, addToWhitelist, removeFromWhitelist, readOps, addOp, removeOp } from '../services/config.service'
import { screenService } from '../services/screen.service'

export function registerSettingsHandlers() {
  ipcMain.handle(IPC.SETTINGS_READ, async (_event, serverId: string) => {
    return readSettings(serverId)
  })

  ipcMain.handle(IPC.SETTINGS_PERSIST, async (_event, serverId: string, settings: ServerSettings) => {
    const status = await screenService.getStatus(serverId)
    if (status === 'running') {
      throw new Error('Stop the server before applying settings changes.')
    }
    await persistSettings(serverId, settings)
  })

  ipcMain.handle(IPC.WHITELIST_READ, async (_event, serverId: string) => {
    return readWhitelist(serverId)
  })

  ipcMain.handle(IPC.WHITELIST_ADD, async (_event, serverId: string, name: string) => {
    return addToWhitelist(serverId, name)
  })

  ipcMain.handle(IPC.WHITELIST_REMOVE, async (_event, serverId: string, name: string) => {
    return removeFromWhitelist(serverId, name)
  })

  ipcMain.handle(IPC.OPS_READ, async (_event, serverId: string) => {
    return readOps(serverId)
  })

  ipcMain.handle(IPC.OPS_ADD, async (_event, serverId: string, name: string) => {
    return addOp(serverId, name)
  })

  ipcMain.handle(IPC.OPS_REMOVE, async (_event, serverId: string, name: string) => {
    return removeOp(serverId, name)
  })
}
