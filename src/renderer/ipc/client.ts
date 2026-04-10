import { IPC } from '@shared/types'
import type { ServerConfig, ServerSettings, InstallStep, LogChunk, WhitelistEntry, OpsEntry, ConfigDirEntry, TrackerState, GithubArtifact, ModDropinEntry, ModDropinState } from '@shared/types'

// Type-safe wrappers around window.electron.invoke

declare global {
  interface Window {
    electron: {
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
      on: (channel: string, listener: (...args: unknown[]) => void) => () => void
      removeAllListeners: (channel: string) => void
    }
  }
}

const invoke = window.electron.invoke.bind(window.electron)
const on = window.electron.on.bind(window.electron)

// --- Servers ---
export const serversApi = {
  list: () => invoke(IPC.SERVERS_LIST) as Promise<ServerConfig[]>,
  create: (data: Omit<ServerConfig, 'id' | 'isInstalled' | 'lastKnownStatus' | 'lastChecked' | 'createdAt' | 'updatedAt'>) =>
    invoke(IPC.SERVERS_CREATE, data) as Promise<ServerConfig>,
  update: (id: string, updates: Partial<ServerConfig>) =>
    invoke(IPC.SERVERS_UPDATE, id, updates) as Promise<ServerConfig>,
  delete: (id: string) => invoke(IPC.SERVERS_DELETE, id) as Promise<void>,
  testConnection: (id: string) =>
    invoke(IPC.SERVERS_TEST_CONNECTION, id) as Promise<{ ok: boolean; error?: string }>,
  testDirect: (sshData: import('@shared/types').ServerConfig['ssh']) =>
    invoke(IPC.SERVERS_TEST_DIRECT, sshData) as Promise<{ ok: boolean; error?: string }>,
}

// --- Control ---
export const controlApi = {
  status: (serverId: string) =>
    invoke(IPC.CONTROL_STATUS, serverId) as Promise<'running' | 'stopped' | 'unknown'>,
  start: (serverId: string) => invoke(IPC.CONTROL_START, serverId) as Promise<void>,
  stop: (serverId: string) => invoke(IPC.CONTROL_STOP, serverId) as Promise<void>,
  send: (serverId: string, text: string) => invoke(IPC.CONTROL_SEND, serverId, text) as Promise<void>,
  wipeWorld: (serverId: string) => invoke(IPC.CONTROL_WIPE_WORLD, serverId) as Promise<void>,
}

// --- Settings ---
export const settingsApi = {
  read: (serverId: string) => invoke(IPC.SETTINGS_READ, serverId) as Promise<ServerSettings>,
  persist: (serverId: string, settings: ServerSettings) =>
    invoke(IPC.SETTINGS_PERSIST, serverId, settings) as Promise<void>,
}

// --- Whitelist ---
export const whitelistApi = {
  read: (serverId: string) =>
    invoke(IPC.WHITELIST_READ, serverId) as Promise<WhitelistEntry[]>,
  add: (serverId: string, name: string) =>
    invoke(IPC.WHITELIST_ADD, serverId, name) as Promise<WhitelistEntry[]>,
  remove: (serverId: string, name: string) =>
    invoke(IPC.WHITELIST_REMOVE, serverId, name) as Promise<WhitelistEntry[]>,
}

// --- Install ---
export const installApi = {
  start: (serverId: string, downloadUrl?: string, sudoPassword?: string, skipUpdates?: boolean, artifactName?: string) =>
    invoke(IPC.INSTALL_START, serverId, downloadUrl, sudoPassword, skipUpdates, artifactName) as Promise<void>,
  onProgress: (handler: (step: InstallStep) => void) =>
    on(IPC.INSTALL_PROGRESS, (step) => handler(step as InstallStep)),
}

// --- Logs ---
export const logsApi = {
  start: (serverId: string) => invoke(IPC.LOGS_START, serverId) as Promise<void>,
  stop: (serverId: string) => invoke(IPC.LOGS_STOP, serverId) as Promise<void>,
  onChunk: (handler: (serverId: string, chunk: LogChunk) => void) =>
    on(IPC.LOGS_CHUNK, (serverId, chunk) =>
      handler(serverId as string, chunk as LogChunk)
    ),
}

// --- Ops ---
export const opsApi = {
  read: (serverId: string) => invoke(IPC.OPS_READ, serverId) as Promise<OpsEntry[]>,
  add: (serverId: string, name: string) => invoke(IPC.OPS_ADD, serverId, name) as Promise<OpsEntry[]>,
  remove: (serverId: string, name: string) => invoke(IPC.OPS_REMOVE, serverId, name) as Promise<OpsEntry[]>,
}

// --- Config file browser ---
export const configsApi = {
  listDir: (serverId: string, relPath: string) =>
    invoke(IPC.CONFIGS_LIST_DIR, serverId, relPath) as Promise<ConfigDirEntry[]>,
  read: (serverId: string, relPath: string) =>
    invoke(IPC.CONFIGS_READ, serverId, relPath) as Promise<string>,
  write: (serverId: string, relPath: string, content: string, changedFields?: Record<string, string>) =>
    invoke(IPC.CONFIGS_WRITE, serverId, relPath, content, changedFields) as Promise<void>,
}

// --- Config change tracker ---
export const trackerApi = {
  read: (serverId: string) => invoke(IPC.TRACKER_READ, serverId) as Promise<TrackerState>,
  remove: (serverId: string, relPath: string) => invoke(IPC.TRACKER_REMOVE, serverId, relPath) as Promise<TrackerState>,
  reapply: (serverId: string, relPaths: string[]) => invoke(IPC.TRACKER_REAPPLY, serverId, relPaths) as Promise<void>,
}

// --- GitHub ---
export const githubApi = {
  listArtifacts: (serverId: string) =>
    invoke(IPC.GITHUB_LIST_ARTIFACTS, serverId) as Promise<GithubArtifact[]>,
}

// --- Update ---
export const updateApi = {
  start: (serverId: string, downloadUrl: string, artifactName?: string) =>
    invoke(IPC.UPDATE_START, serverId, downloadUrl, artifactName) as Promise<void>,
  onProgress: (handler: (step: InstallStep) => void) =>
    on(IPC.UPDATE_PROGRESS, (step) => handler(step as InstallStep)),
}

// --- Mods drop-in ---
export const modsDropinApi = {
  read: (serverId: string) =>
    invoke(IPC.MODS_DROPIN_READ, serverId) as Promise<ModDropinState>,
  download: (serverId: string, url: string) =>
    invoke(IPC.MODS_DROPIN_DOWNLOAD, serverId, url) as Promise<ModDropinEntry>,
  delete: (serverId: string, filename: string) =>
    invoke(IPC.MODS_DROPIN_DELETE, serverId, filename) as Promise<ModDropinState>,
  configure: (serverId: string, filename: string, mode: 'dropin' | 'replace', replaceTarget: string | null) =>
    invoke(IPC.MODS_DROPIN_CONFIGURE, serverId, filename, mode, replaceTarget) as Promise<ModDropinState>,
  apply: (serverId: string) =>
    invoke(IPC.MODS_DROPIN_APPLY, serverId) as Promise<string>,
}

// --- Push events ---
export const events = {
  onStatusChanged: (handler: (payload: { id: string; status: string }) => void) =>
    on('server:statusChanged', (payload) => handler(payload as { id: string; status: string })),
}
