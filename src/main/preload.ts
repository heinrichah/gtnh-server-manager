import { contextBridge, ipcRenderer } from 'electron'

// Expose a typed API to the renderer via window.electron
contextBridge.exposeInMainWorld('electron', {
  // Request/response (renderer → main)
  invoke: (channel: string, ...args: unknown[]) =>
    ipcRenderer.invoke(channel, ...args),

  // One-way events (main → renderer)
  on: (channel: string, listener: (...args: unknown[]) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, ...args: unknown[]) =>
      listener(...args)
    ipcRenderer.on(channel, subscription)
    // Return cleanup function
    return () => ipcRenderer.removeListener(channel, subscription)
  },

  // Remove all listeners for a channel
  removeAllListeners: (channel: string) =>
    ipcRenderer.removeAllListeners(channel),
})
