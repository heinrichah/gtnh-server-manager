import { sshService } from './ssh.service'
import { getServer } from '../store/store'
import { parseCfgLines, serializeCfgLines } from '../../shared/cfg-parser'

export interface TrackedChange {
  changedAt: string
  fields: Record<string, string>
}

export interface TrackerState {
  version: number
  lastUpdated: string
  changes: Record<string, TrackedChange>
}

function stateFilePath(installPath: string): string {
  return `${installPath}/gtnh-manager-state.json`
}

async function readState(serverId: string): Promise<TrackerState> {
  const config = getServer(serverId)
  if (!config) return emptyState()
  try {
    const raw = await sshService.downloadText(serverId, stateFilePath(config.installPath))
    return JSON.parse(raw) as TrackerState
  } catch {
    return emptyState()
  }
}

function emptyState(): TrackerState {
  return { version: 2, lastUpdated: new Date().toISOString(), changes: {} }
}

async function writeState(serverId: string, state: TrackerState): Promise<void> {
  const config = getServer(serverId)
  if (!config) return
  state.lastUpdated = new Date().toISOString()
  await sshService.uploadText(serverId, stateFilePath(config.installPath), JSON.stringify(state, null, 2))
}

/** Record that specific fields were changed in a file. Merges into existing tracked fields. */
export async function recordChange(serverId: string, relToInstall: string, fields: Record<string, string>): Promise<void> {
  const state = await readState(serverId)
  const existing = state.changes[relToInstall]
  state.changes[relToInstall] = {
    changedAt: new Date().toISOString(),
    fields: { ...(existing?.fields ?? {}), ...fields },
  }
  await writeState(serverId, state)
}

export async function removeChange(serverId: string, relToInstall: string): Promise<TrackerState> {
  const state = await readState(serverId)
  delete state.changes[relToInstall]
  await writeState(serverId, state)
  return state
}

export async function getState(serverId: string): Promise<TrackerState> {
  return readState(serverId)
}

/**
 * Re-applies the tracked field values for one or more files back onto the server.
 * Reads the current file content, patches only the tracked keys, writes back.
 * relPaths are relative to installPath (e.g. "server-files/config/GregTech/Pollution.cfg").
 */
export async function reapplyChanges(serverId: string, relPaths: string[]): Promise<void> {
  const config = getServer(serverId)
  if (!config) throw new Error(`Server ${serverId} not found`)

  const state = await readState(serverId)

  for (const relPath of relPaths) {
    const tracked = state.changes[relPath]
    if (!tracked || Object.keys(tracked.fields).length === 0) continue

    const fullPath = `${config.installPath}/${relPath}`
    const current = await sshService.downloadText(serverId, fullPath)
    const lines = parseCfgLines(current)

    for (const line of lines) {
      if (line.type === 'gt_property' || line.type === 'simple_property') {
        if (Object.prototype.hasOwnProperty.call(tracked.fields, line.key)) {
          line.value = tracked.fields[line.key]
        }
      }
    }

    await sshService.uploadText(serverId, fullPath, serializeCfgLines(lines))
  }
}
