import { sshService } from './ssh.service'
import { serverFilesPath } from './screen.service'
import { getServer } from '../store/store'
import type { ModDropinEntry, ModDropinState } from '../../shared/types'

function modsDropinDir(installPath: string): string {
  return `${installPath}/mods-dropin`
}

function stateFilePath(installPath: string): string {
  return `${installPath}/mods-dropin/state.json`
}

function emptyState(): ModDropinState {
  return { version: 1, mods: {} }
}

function shellEscape(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`
}

export async function readDropinState(serverId: string): Promise<ModDropinState> {
  const config = getServer(serverId)
  if (!config) return emptyState()
  try {
    const raw = await sshService.downloadText(serverId, stateFilePath(config.installPath))
    return JSON.parse(raw) as ModDropinState
  } catch {
    return emptyState()
  }
}

async function writeDropinState(serverId: string, state: ModDropinState): Promise<void> {
  const config = getServer(serverId)
  if (!config) return
  await sshService.uploadText(serverId, stateFilePath(config.installPath), JSON.stringify(state, null, 2))
}

export async function downloadMod(serverId: string, url: string): Promise<ModDropinEntry> {
  const config = getServer(serverId)
  if (!config) throw new Error(`Server ${serverId} not found`)

  let filename: string
  try {
    filename = new URL(url).pathname.split('/').pop() ?? ''
  } catch {
    filename = ''
  }
  if (!filename) throw new Error('Could not determine filename from URL')

  const dropin = modsDropinDir(config.installPath)
  const destPath = `${dropin}/${filename}`
  const result = await sshService.executeCommand(
    serverId,
    `mkdir -p ${shellEscape(dropin)} && wget -O ${shellEscape(destPath)} ${shellEscape(url)}`
  )
  if (result.code !== 0) {
    throw new Error(`Download failed: ${result.stderr || result.stdout}`)
  }

  const entry: ModDropinEntry = {
    filename,
    sourceUrl: url,
    addedAt: new Date().toISOString(),
    mode: 'dropin',
    replaceTarget: null,
  }

  const state = await readDropinState(serverId)
  state.mods[filename] = entry
  await writeDropinState(serverId, state)

  return entry
}

export async function deleteMod(serverId: string, filename: string): Promise<ModDropinState> {
  const config = getServer(serverId)
  if (!config) throw new Error(`Server ${serverId} not found`)

  const dropin = modsDropinDir(config.installPath)
  await sshService.executeCommand(serverId, `rm -f ${shellEscape(`${dropin}/${filename}`)}`)

  const state = await readDropinState(serverId)
  delete state.mods[filename]
  await writeDropinState(serverId, state)

  return state
}

export async function configureMod(
  serverId: string,
  filename: string,
  mode: 'dropin' | 'replace',
  replaceTarget: string | null
): Promise<ModDropinState> {
  const state = await readDropinState(serverId)
  const entry = state.mods[filename]
  if (!entry) throw new Error(`Mod ${filename} not found in state`)

  entry.mode = mode
  entry.replaceTarget = replaceTarget
  await writeDropinState(serverId, state)

  return state
}

export async function applyDropinMods(serverId: string, filesPath: string): Promise<string> {
  const state = await readDropinState(serverId)
  const mods = Object.values(state.mods)
  if (mods.length === 0) return 'No drop-in mods configured.'

  const config = getServer(serverId)
  if (!config) return 'Server not found.'
  const dropin = modsDropinDir(config.installPath)

  const lines: string[] = []

  for (const mod of mods) {
    const src = shellEscape(`${dropin}/${mod.filename}`)
    let cmd: string

    if (mod.mode === 'replace' && mod.replaceTarget) {
      const dst = shellEscape(`${filesPath}/mods/${mod.replaceTarget}`)
      cmd = `cp -f ${src} ${dst}`
    } else {
      const dst = shellEscape(`${filesPath}/mods/`)
      cmd = `cp -f ${src} ${dst}`
    }

    const result = await sshService.executeCommand(serverId, cmd)
    if (result.code === 0) {
      const target = mod.mode === 'replace' && mod.replaceTarget
        ? `→ ${mod.replaceTarget}`
        : '→ mods/ (new)'
      lines.push(`✓ ${mod.filename} ${target}`)
    } else {
      lines.push(`✗ ${mod.filename}: ${result.stderr || result.stdout || `exit ${result.code}`}`)
    }
  }

  return lines.join('\n')
}
