import { ipcMain } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { IPC } from '../../shared/types'
import type { ServerConfig } from '../../shared/types'
import { getServers, upsertServer, deleteServer } from '../store/store'
import { sshService } from '../services/ssh.service'

export function registerServersHandlers() {
  ipcMain.handle(IPC.SERVERS_LIST, async () => {
    return getServers().map(redactCredentials)
  })

  ipcMain.handle(IPC.SERVERS_CREATE, async (_event, data: Omit<ServerConfig, 'id' | 'isInstalled' | 'lastKnownStatus' | 'lastChecked' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString()
    const server: ServerConfig = {
      ...data,
      id: uuidv4(),
      isInstalled: false,
      lastKnownStatus: 'unknown',
      lastChecked: now,
      createdAt: now,
      updatedAt: now,
    }
    upsertServer(server)
    return redactCredentials(server)
  })

  ipcMain.handle(IPC.SERVERS_UPDATE, async (_event, id: string, updates: Partial<ServerConfig>) => {
    const servers = getServers()
    const existing = servers.find((s) => s.id === id)
    if (!existing) throw new Error(`Server ${id} not found`)

    const updated: ServerConfig = {
      ...existing,
      ...updates,
      id, // don't allow id change
      updatedAt: new Date().toISOString(),
    }
    upsertServer(updated)
    // Invalidate SSH connection so it reconnects with new credentials
    await sshService.disconnect(id)
    return redactCredentials(updated)
  })

  ipcMain.handle(IPC.SERVERS_DELETE, async (_event, id: string) => {
    await sshService.disconnect(id)
    deleteServer(id)
  })

  ipcMain.handle(IPC.SERVERS_TEST_CONNECTION, async (_event, id: string) => {
    const servers = getServers()
    const config = servers.find((s) => s.id === id)
    if (!config) return { ok: false, error: 'Server not found' }

    try {
      await sshService.testConnection(config)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: String(err instanceof Error ? err.message : err) }
    }
  })

  // Test using credentials directly — does NOT save to persistent storage
  ipcMain.handle(IPC.SERVERS_TEST_DIRECT, async (_event, data: ServerConfig['ssh'] & { host: string }) => {
    const fakeConfig = {
      id: '__test__',
      displayName: '',
      ssh: data,
      installPath: '',
      isInstalled: false,
      lastKnownStatus: 'unknown' as const,
      lastChecked: '',
      createdAt: '',
      updatedAt: '',
    }
    try {
      await sshService.testConnection(fakeConfig)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: String(err instanceof Error ? err.message : err) }
    }
  })
}

/** Strip sensitive fields before sending to renderer */
function redactCredentials(server: ServerConfig): ServerConfig {
  const copy = JSON.parse(JSON.stringify(server)) as ServerConfig
  if (copy.ssh.password) copy.ssh.password = '••••••••'
  if (copy.ssh.passphrase) copy.ssh.passphrase = '••••••••'
  return copy
}
