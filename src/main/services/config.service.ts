import path from 'path'
import https from 'https'
import { sshService } from './ssh.service'
import { serverFilesPath } from './screen.service'
import { getServer } from '../store/store'
import type { ServerSettings, WhitelistEntry, OpsEntry } from '../../shared/types'
import { v4 as uuidv4 } from 'uuid'
import {
  getCfgValue,
  setCfgValue,
  getSimpleValue,
  setSimpleValue,
  getMemoryFromScript,
  setMemoryInScript,
} from '../utils/cfg-parser'

function serverPaths(installPath: string) {
  return {
    startScript: `${installPath}/startserver-java9.sh`,
    pollutionCfg: `${installPath}/config/GregTech/Pollution.cfg`,
    serverUtilitiesCfg: `${installPath}/serverutilities/serverutilities.cfg`,
    ranksTxt: `${installPath}/serverutilities/server/ranks.txt`,
  }
}

export async function readSettings(serverId: string): Promise<ServerSettings> {
  const config = getServer(serverId)
  if (!config) throw new Error(`Server ${serverId} not found`)

  const p = serverPaths(serverFilesPath(config.installPath))

  const [scriptContent, pollutionContent, sutilitiesContent, ranksContent] = await Promise.all([
    sshService.downloadText(serverId, p.startScript),
    sshService.downloadText(serverId, p.pollutionCfg),
    sshService.downloadText(serverId, p.serverUtilitiesCfg),
    sshService.downloadText(serverId, p.ranksTxt).catch(() => ''),
  ])

  const memory = getMemoryFromScript(scriptContent) ?? { minGb: 6, maxGb: 6 }

  const pollutionActivated = getCfgValue(pollutionContent, 'Activate Pollution')
  const pollution = { activated: pollutionActivated?.toLowerCase() === 'true' }

  const backupsEnabled = getSimpleValue(sutilitiesContent, 'enable_backups')
  const backupInterval = getSimpleValue(sutilitiesContent, 'backup_timer_minutes')
  const maxBackups = getSimpleValue(sutilitiesContent, 'max_backups')
  const chunkClaiming = getSimpleValue(sutilitiesContent, 'chunk_claiming')
  const chunkLoading = getSimpleValue(sutilitiesContent, 'chunk_loading')
  const ranksEnabled = getSimpleValue(sutilitiesContent, 'enabled')

  return {
    memory,
    pollution,
    serverUtilities: {
      backupsEnabled: backupsEnabled === 'true',
      backupIntervalMinutes: backupInterval ? parseInt(backupInterval, 10) : 60,
      maxBackups: maxBackups ? parseInt(maxBackups, 10) : 3,
      chunkClaimingEnabled: chunkClaiming === 'true',
      chunkLoadingEnabled: chunkLoading === 'true',
      ranksEnabled: ranksEnabled === 'true',
    },
    ranksRawText: ranksContent,
  }
}

export async function persistSettings(serverId: string, settings: ServerSettings): Promise<void> {
  const config = getServer(serverId)
  if (!config) throw new Error(`Server ${serverId} not found`)

  const p = serverPaths(serverFilesPath(config.installPath))

  // Read current file contents
  const [scriptContent, pollutionContent, sutilitiesContent] = await Promise.all([
    sshService.downloadText(serverId, p.startScript),
    sshService.downloadText(serverId, p.pollutionCfg),
    sshService.downloadText(serverId, p.serverUtilitiesCfg),
  ])

  // Apply changes (only modify targeted lines, preserve everything else)
  const newScript = setMemoryInScript(scriptContent, settings.memory.minGb, settings.memory.maxGb)

  let newPollution = pollutionContent
  try {
    newPollution = setCfgValue(pollutionContent, 'Activate Pollution', String(settings.pollution.activated))
  } catch {
    // Key not found — append it
    newPollution += `\n    B:"Activate Pollution"=${settings.pollution.activated}`
  }

  let newSutilities = sutilitiesContent
  const su = settings.serverUtilities
  const suUpdates: [string, string][] = [
    ['enable_backups', String(su.backupsEnabled)],
    ['backup_timer_minutes', String(su.backupIntervalMinutes)],
    ['max_backups', String(su.maxBackups)],
    ['chunk_claiming', String(su.chunkClaimingEnabled)],
    ['chunk_loading', String(su.chunkLoadingEnabled)],
    ['enabled', String(su.ranksEnabled)],
  ]
  for (const [key, value] of suUpdates) {
    try {
      newSutilities = setSimpleValue(newSutilities, key, value)
    } catch {
      // Key not found, skip
    }
  }

  // Write back in parallel
  await Promise.all([
    sshService.uploadText(serverId, p.startScript, newScript),
    sshService.uploadText(serverId, p.pollutionCfg, newPollution),
    sshService.uploadText(serverId, p.serverUtilitiesCfg, newSutilities),
    ...(settings.ranksRawText
      ? [sshService.uploadText(serverId, p.ranksTxt, settings.ranksRawText)]
      : []),
  ])
}

// ---- Whitelist management ----

export async function readWhitelist(serverId: string): Promise<WhitelistEntry[]> {
  const config = getServer(serverId)
  if (!config) throw new Error(`Server ${serverId} not found`)
  try {
    const raw = await sshService.downloadText(serverId, `${serverFilesPath(config.installPath)}/whitelist.json`)
    return JSON.parse(raw) as WhitelistEntry[]
  } catch {
    return []
  }
}

export async function addToWhitelist(serverId: string, name: string): Promise<WhitelistEntry[]> {
  const config = getServer(serverId)
  if (!config) throw new Error(`Server ${serverId} not found`)

  const whitelistPath = `${serverFilesPath(config.installPath)}/whitelist.json`
  const current = await readWhitelist(serverId)

  if (current.some((e) => e.name.toLowerCase() === name.toLowerCase())) {
    return current // already whitelisted
  }

  // Try to resolve UUID from Mojang (works for online-mode servers)
  // Falls back to a v4 UUID for offline-mode servers (Minecraft will update it on first join)
  let uuid: string
  try {
    uuid = await fetchMojangUuid(name)
  } catch {
    uuid = uuidv4()
  }

  const entry: WhitelistEntry = { uuid, name }
  const updated = [...current, entry]
  await sshService.uploadText(serverId, whitelistPath, JSON.stringify(updated, null, 2))
  return updated
}

export async function removeFromWhitelist(serverId: string, name: string): Promise<WhitelistEntry[]> {
  const config = getServer(serverId)
  if (!config) throw new Error(`Server ${serverId} not found`)

  const whitelistPath = `${serverFilesPath(config.installPath)}/whitelist.json`
  const current = await readWhitelist(serverId)
  const updated = current.filter((e) => e.name.toLowerCase() !== name.toLowerCase())
  await sshService.uploadText(serverId, whitelistPath, JSON.stringify(updated, null, 2))
  return updated
}

// ---- Ops management ----

export async function readOps(serverId: string): Promise<OpsEntry[]> {
  const config = getServer(serverId)
  if (!config) throw new Error(`Server ${serverId} not found`)
  try {
    const raw = await sshService.downloadText(serverId, `${serverFilesPath(config.installPath)}/ops.json`)
    return JSON.parse(raw) as OpsEntry[]
  } catch {
    return []
  }
}

export async function addOp(serverId: string, name: string): Promise<OpsEntry[]> {
  const config = getServer(serverId)
  if (!config) throw new Error(`Server ${serverId} not found`)

  const opsPath = `${serverFilesPath(config.installPath)}/ops.json`
  const current = await readOps(serverId)

  if (current.some((e) => e.name.toLowerCase() === name.toLowerCase())) return current

  let uuid: string
  try { uuid = await fetchMojangUuid(name) } catch { uuid = uuidv4() }

  const updated = [...current, { uuid, name, level: 4, bypassesPlayerLimit: false }]
  await sshService.uploadText(serverId, opsPath, JSON.stringify(updated, null, 2))
  return updated
}

export async function removeOp(serverId: string, name: string): Promise<OpsEntry[]> {
  const config = getServer(serverId)
  if (!config) throw new Error(`Server ${serverId} not found`)

  const opsPath = `${serverFilesPath(config.installPath)}/ops.json`
  const current = await readOps(serverId)
  const updated = current.filter((e) => e.name.toLowerCase() !== name.toLowerCase())
  await sshService.uploadText(serverId, opsPath, JSON.stringify(updated, null, 2))
  return updated
}

function fetchMojangUuid(name: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(name)}`,
      (res) => {
        let data = ''
        res.on('data', (chunk: Buffer) => { data += chunk.toString() })
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const json = JSON.parse(data) as { id: string; name: string }
              // Mojang returns UUID without dashes — insert them
              const raw = json.id
              const uuid = `${raw.slice(0,8)}-${raw.slice(8,12)}-${raw.slice(12,16)}-${raw.slice(16,20)}-${raw.slice(20)}`
              resolve(uuid)
            } catch {
              reject(new Error('Invalid Mojang response'))
            }
          } else {
            reject(new Error(`Mojang API returned ${res.statusCode}`))
          }
        })
      }
    )
    req.on('error', reject)
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('Mojang API timeout')) })
  })
}
