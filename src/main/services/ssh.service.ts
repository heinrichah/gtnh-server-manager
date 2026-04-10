import { NodeSSH } from 'node-ssh'
import type { ServerConfig } from '../../shared/types'
import { getServer } from '../store/store'

export interface ExecResult {
  stdout: string
  stderr: string
  code: number
}

// Connection pool: serverId → NodeSSH instance
const pool = new Map<string, NodeSSH>()

async function buildConnection(config: ServerConfig): Promise<NodeSSH> {
  const ssh = new NodeSSH()
  const { ssh: s } = config

  const connectConfig: Parameters<NodeSSH['connect']>[0] = {
    host: s.host,
    port: s.port,
    username: s.username,
  }

  if (s.authMethod === 'password' && s.password) {
    connectConfig.password = s.password
  } else if (s.authMethod === 'privateKey' && s.privateKeyPath) {
    connectConfig.privateKeyPath = s.privateKeyPath
    if (s.passphrase) connectConfig.passphrase = s.passphrase
  }

  await ssh.connect(connectConfig)
  return ssh
}

async function getConnection(serverId: string): Promise<NodeSSH> {
  const existing = pool.get(serverId)
  if (existing?.isConnected()) return existing

  // No live connection — build a fresh one
  const config = getServer(serverId)
  if (!config) throw new Error(`Server ${serverId} not found`)

  const ssh = await buildConnection(config)
  pool.set(serverId, ssh)
  return ssh
}

/**
 * Execute a command via SSH.
 * On first failure, the cached connection is discarded and one retry is made
 * with a fresh connection — this handles silently broken TCP sessions.
 */
async function executeCommand(serverId: string, command: string): Promise<ExecResult> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const ssh = await getConnection(serverId)
      const result = await ssh.execCommand(command)
      return {
        stdout: result.stdout,
        stderr: result.stderr,
        code: result.code ?? 0,
      }
    } catch (err) {
      if (attempt === 0) {
        // Drop the stale connection and retry once with a fresh one
        await disconnect(serverId)
      } else {
        throw err
      }
    }
  }
  // Unreachable but satisfies TypeScript
  throw new Error('executeCommand: unexpected state')
}

/** Execute a command and call onData for each chunk of output as it arrives. Returns ExecResult on completion. */
async function executeCommandStreaming(
  serverId: string,
  command: string,
  onData: (data: string) => void
): Promise<ExecResult> {
  const ssh = await getConnection(serverId)
  const result = await ssh.execCommand(command, {
    onStdout: (chunk) => onData(chunk.toString()),
    onStderr: (chunk) => onData(chunk.toString()),
  })
  return { stdout: result.stdout, stderr: result.stderr, code: result.code ?? 0 }
}

// Stream command output line by line
async function streamCommand(
  serverId: string,
  command: string,
  onData: (type: 'stdout' | 'stderr', data: string) => void,
  onClose?: (code: number) => void
): Promise<void> {
  const ssh = await getConnection(serverId)
  await ssh.execCommand(command, {
    onStdout: (chunk) => onData('stdout', chunk.toString()),
    onStderr: (chunk) => onData('stderr', chunk.toString()),
  })
  onClose?.(0)
}

async function uploadText(serverId: string, remotePath: string, content: string): Promise<void> {
  const ssh = await getConnection(serverId)
  await ssh.execCommand(`cat > ${remotePath} << 'GTNH_EOF'\n${content}\nGTNH_EOF`)
}

async function downloadText(serverId: string, remotePath: string): Promise<string> {
  const result = await executeCommand(serverId, `cat ${remotePath}`)
  if (result.code !== 0) {
    throw new Error(`Failed to read ${remotePath}: ${result.stderr}`)
  }
  return result.stdout
}

/** Open a fresh, un-pooled SSH connection. Caller is responsible for disposing it. */
async function connectRaw(serverId: string): Promise<NodeSSH> {
  const config = getServer(serverId)
  if (!config) throw new Error(`Server ${serverId} not found`)
  return buildConnection(config)
}

async function testConnection(config: ServerConfig): Promise<void> {
  const ssh = new NodeSSH()
  const { ssh: s } = config

  const connectConfig: Parameters<NodeSSH['connect']>[0] = {
    host: s.host,
    port: s.port,
    username: s.username,
  }

  if (s.authMethod === 'password' && s.password) {
    connectConfig.password = s.password
  } else if (s.authMethod === 'privateKey' && s.privateKeyPath) {
    connectConfig.privateKeyPath = s.privateKeyPath
    if (s.passphrase) connectConfig.passphrase = s.passphrase
  }

  await ssh.connect(connectConfig)
  ssh.dispose()
}

async function disconnect(serverId: string): Promise<void> {
  const ssh = pool.get(serverId)
  if (ssh) {
    try { ssh.dispose() } catch { /* ignore */ }
    pool.delete(serverId)
  }
}

async function disconnectAll(): Promise<void> {
  for (const [id, ssh] of pool.entries()) {
    try { ssh.dispose() } catch { /* ignore */ }
    pool.delete(id)
  }
}

export const sshService = {
  getConnection,
  executeCommand,
  executeCommandStreaming,
  streamCommand,
  uploadText,
  downloadText,
  testConnection,
  connectRaw,
  disconnect,
  disconnectAll,
}
