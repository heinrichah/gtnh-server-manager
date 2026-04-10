import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import type { ServerConfig } from '../../shared/types'

interface StoreData {
  servers: ServerConfig[]
}

function getStorePath(): string {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, 'gtnh-servers.json')
}

function readStore(): StoreData {
  try {
    const raw = fs.readFileSync(getStorePath(), 'utf-8')
    return JSON.parse(raw) as StoreData
  } catch {
    return { servers: [] }
  }
}

function writeStore(data: StoreData): void {
  const storePath = getStorePath()
  fs.mkdirSync(path.dirname(storePath), { recursive: true })
  fs.writeFileSync(storePath, JSON.stringify(data, null, 2), 'utf-8')
}

export function getServers(): ServerConfig[] {
  return readStore().servers
}

export function saveServers(servers: ServerConfig[]): void {
  writeStore({ ...readStore(), servers })
}

export function getServer(id: string): ServerConfig | undefined {
  return getServers().find((s) => s.id === id)
}

export function upsertServer(server: ServerConfig): void {
  const servers = getServers()
  const idx = servers.findIndex((s) => s.id === server.id)
  if (idx >= 0) {
    servers[idx] = server
  } else {
    servers.push(server)
  }
  saveServers(servers)
}

export function deleteServer(serverId: string): void {
  saveServers(getServers().filter((s) => s.id !== serverId))
}
