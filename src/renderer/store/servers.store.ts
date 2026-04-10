import { create } from 'zustand'
import type { ServerConfig } from '@shared/types'

interface ServersState {
  servers: ServerConfig[]
  selectedId: string | null
  setServers: (servers: ServerConfig[]) => void
  addServer: (server: ServerConfig) => void
  updateServer: (id: string, updates: Partial<ServerConfig>) => void
  removeServer: (id: string) => void
  selectServer: (id: string | null) => void
}

export const useServersStore = create<ServersState>((set) => ({
  servers: [],
  selectedId: null,

  setServers: (servers) => set({ servers }),

  addServer: (server) =>
    set((state) => ({ servers: [...state.servers, server] })),

  updateServer: (id, updates) =>
    set((state) => ({
      servers: state.servers.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    })),

  removeServer: (id) =>
    set((state) => ({
      servers: state.servers.filter((s) => s.id !== id),
      selectedId: state.selectedId === id ? null : state.selectedId,
    })),

  selectServer: (id) => set({ selectedId: id }),
}))
