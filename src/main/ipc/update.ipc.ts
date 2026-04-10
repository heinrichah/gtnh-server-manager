import { ipcMain, BrowserWindow } from 'electron'
import { IPC } from '../../shared/types'
import { runUpdate } from '../services/update.service'

export function registerUpdateHandlers(win: BrowserWindow) {
  ipcMain.handle(IPC.UPDATE_START, async (_event, serverId: string, downloadUrl: string, artifactName?: string) => {
    runUpdate(serverId, win, downloadUrl, artifactName).catch((err) => {
      win.webContents.send(IPC.UPDATE_PROGRESS, {
        id: '__error__',
        label: 'Update failed',
        status: 'error',
        output: err instanceof Error ? err.message : String(err),
      })
    })
  })
}
