import { ipcMain, BrowserWindow } from 'electron'
import { IPC } from '../../shared/types'
import { runInstall } from '../services/install.service'

export function registerInstallHandlers(win: BrowserWindow) {
  ipcMain.handle(IPC.INSTALL_START, async (_event, serverId: string, downloadUrl?: string, sudoPassword?: string) => {
    // Run async — progress events are pushed via win.webContents.send
    runInstall(serverId, win, downloadUrl, sudoPassword).catch((err) => {
      win.webContents.send(IPC.INSTALL_PROGRESS, {
        id: 'error',
        label: 'Installation failed',
        status: 'error',
        output: err instanceof Error ? err.message : String(err),
      })
    })
  })
}
