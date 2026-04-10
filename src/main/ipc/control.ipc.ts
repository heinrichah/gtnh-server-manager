import { ipcMain, BrowserWindow } from 'electron'
import { IPC } from '../../shared/types'
import { screenService } from '../services/screen.service'
import { upsertServer } from '../store/store'
import { getServer } from '../store/store'

export function registerControlHandlers(win: BrowserWindow) {
  ipcMain.handle(IPC.CONTROL_STATUS, async (_event, serverId: string) => {
    const status = await screenService.getStatus(serverId)
    // Update cached status in store
    const config = getServer(serverId)
    if (config) {
      upsertServer({ ...config, lastKnownStatus: status, lastChecked: new Date().toISOString() })
    }
    return status
  })

  ipcMain.handle(IPC.CONTROL_START, async (_event, serverId: string) => {
    await screenService.startServer(serverId)
    win.webContents.send('server:statusChanged', { id: serverId, status: 'running' })
  })

  ipcMain.handle(IPC.CONTROL_STOP, async (_event, serverId: string) => {
    win.webContents.send('server:statusChanged', { id: serverId, status: 'stopping' })
    await screenService.stopServer(serverId)
    win.webContents.send('server:statusChanged', { id: serverId, status: 'stopped' })
  })
}
