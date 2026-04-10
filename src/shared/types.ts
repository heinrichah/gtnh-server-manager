export interface ServerConfig {
  id: string
  displayName: string
  osType?: 'ubuntu' | 'debian'
  ssh: {
    host: string
    port: number
    username: string
    authMethod: 'password' | 'privateKey'
    password?: string
    privateKeyPath?: string
    passphrase?: string
    knownHostFingerprint?: string
  }
  installPath: string
  memoryGb?: number
  githubToken?: string
  installedVersion?: string
  isInstalled: boolean
  lastKnownStatus: 'running' | 'stopped' | 'unknown'
  lastChecked: string
  createdAt: string
  updatedAt: string
}

export interface ServerSettings {
  memory: {
    minGb: number
    maxGb: number
  }
  pollution: {
    activated: boolean
  }
  serverUtilities: {
    backupsEnabled: boolean
    backupIntervalMinutes: number
    maxBackups: number
    chunkClaimingEnabled: boolean
    chunkLoadingEnabled: boolean
    ranksEnabled: boolean
  }
  ranksRawText: string
}

export interface WhitelistEntry {
  uuid: string
  name: string
}

export interface OpsEntry {
  uuid: string
  name: string
  level: number
  bypassesPlayerLimit: boolean
}

export interface InstallStep {
  id: string
  label: string
  status: 'pending' | 'running' | 'success' | 'error'
  output?: string
}

export interface LogChunk {
  type: 'stdout' | 'stderr' | 'system'
  data: string
  timestamp: string
}

// IPC channel names as constants to avoid typos
export const IPC = {
  SERVERS_LIST: 'servers:list',
  SERVERS_CREATE: 'servers:create',
  SERVERS_UPDATE: 'servers:update',
  SERVERS_DELETE: 'servers:delete',
  SERVERS_TEST_CONNECTION: 'servers:testConnection',
  SERVERS_TEST_DIRECT: 'servers:testDirect',

  INSTALL_START: 'install:start',
  INSTALL_PROGRESS: 'install:progress',

  CONTROL_START: 'control:start',
  CONTROL_STOP: 'control:stop',
  CONTROL_STATUS: 'control:status',
  CONTROL_SEND: 'control:send',
  CONTROL_WIPE_WORLD: 'control:wipeWorld',

  SETTINGS_READ: 'settings:read',
  SETTINGS_PERSIST: 'settings:persist',

  WHITELIST_READ: 'whitelist:read',
  WHITELIST_ADD: 'whitelist:add',
  WHITELIST_REMOVE: 'whitelist:remove',

  OPS_READ: 'ops:read',
  OPS_ADD: 'ops:add',
  OPS_REMOVE: 'ops:remove',

  LOGS_START: 'logs:start',
  LOGS_STOP: 'logs:stop',
  LOGS_CHUNK: 'logs:chunk',

  CONFIGS_LIST_DIR: 'configs:listDir',
  CONFIGS_READ: 'configs:read',
  CONFIGS_WRITE: 'configs:write',

  TRACKER_READ: 'tracker:read',
  TRACKER_REMOVE: 'tracker:remove',
  TRACKER_REAPPLY: 'tracker:reapply',

  GITHUB_LIST_ARTIFACTS: 'github:listArtifacts',

  UPDATE_START: 'update:start',
  UPDATE_PROGRESS: 'update:progress',

  MODS_DROPIN_READ: 'modsDropin:read',
  MODS_DROPIN_DOWNLOAD: 'modsDropin:download',
  MODS_DROPIN_DELETE: 'modsDropin:delete',
  MODS_DROPIN_CONFIGURE: 'modsDropin:configure',
  MODS_DROPIN_APPLY: 'modsDropin:apply',
} as const

export interface ModDropinEntry {
  filename: string
  sourceUrl: string
  addedAt: string
  mode: 'dropin' | 'replace'
  replaceTarget: string | null
}

export interface ModDropinState {
  version: number
  mods: Record<string, ModDropinEntry>
}

export interface ConfigDirEntry {
  name: string
  isDir: boolean
}

export interface GithubArtifact {
  id: number
  name: string
  size_in_bytes: number
  archive_download_url: string
  expired: boolean
  created_at: string
  expires_at: string
  workflow_run: {
    head_branch: string
    head_sha: string
  }
}

export interface TrackedChange {
  changedAt: string
  fields: Record<string, string>
}

export interface TrackerState {
  version: number
  lastUpdated: string
  changes: Record<string, TrackedChange>
}
