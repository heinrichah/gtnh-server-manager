import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { registerServersHandlers } from './ipc/servers.ipc'
import { registerControlHandlers } from './ipc/control.ipc'
import { registerSettingsHandlers } from './ipc/settings.ipc'
import { registerInstallHandlers } from './ipc/install.ipc'
import { registerLogsHandlers, disposeAllLogConnections } from './ipc/logs.ipc'
import { registerConfigsHandlers } from './ipc/configs.ipc'
import { registerGithubHandlers } from './ipc/github.ipc'
import { registerUpdateHandlers } from './ipc/update.ipc'
import { registerModsDropinHandlers } from './ipc/modsDropin.ipc'
import { sshService } from './services/ssh.service'

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'GTNH Server Manager',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  return mainWindow
}

app.whenReady().then(() => {
  const win = createWindow()

  // Register all IPC handlers, passing window reference for push events
  registerServersHandlers()
  registerControlHandlers(win)
  registerSettingsHandlers()
  registerInstallHandlers(win)
  registerLogsHandlers(win)
  registerConfigsHandlers()
  registerGithubHandlers()
  registerUpdateHandlers(win)
  registerModsDropinHandlers()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', async () => {
  disposeAllLogConnections()
  await sshService.disconnectAll()
  if (process.platform !== 'darwin') app.quit()
})
