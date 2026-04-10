export interface ServerConfig {
  id: string
  displayName: string
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

export interface SshLogEntry {
  timestamp: string
  serverId: string
  command: string
  exitCode: number
  durationMs: number
  stderr?: string
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

  SSH_LOG: 'ssh:log',

  CONFIGS_LIST_DIR: 'configs:listDir',
  CONFIGS_READ: 'configs:read',
  CONFIGS_WRITE: 'configs:write',
} as const

export interface ConfigDirEntry {
  name: string
  isDir: boolean
}
