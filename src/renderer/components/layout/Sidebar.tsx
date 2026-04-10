import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Plus, Server, Trash2, Check, X, Pencil } from 'lucide-react'
import { useServersStore } from '../../store/servers.store'
import { serversApi } from '../../ipc/client'
import { ServerForm } from '../servers/ServerForm'
import { StatusBadge } from '../servers/StatusBadge'
import { cn } from '../../lib/utils'
import type { ServerConfig } from '@shared/types'

export function Sidebar() {
  const { servers, removeServer, addServer, updateServer, selectServer } = useServersStore()
  const [showForm, setShowForm] = useState(false)
  const [editingServer, setEditingServer] = useState<ServerConfig | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const navigate = useNavigate()
  const { id: selectedId } = useParams<{ id: string }>()

  async function handleDeleteConfirm(id: string) {
    setPendingDeleteId(null)
    await serversApi.delete(id)
    removeServer(id)
    navigate('/')
  }

  return (
    <aside className="w-64 border-r border-border flex flex-col">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-1">
          <Server className="w-5 h-5 text-primary" />
          <h1 className="font-semibold text-sm tracking-wide uppercase text-muted-foreground">
            GTNH Manager
          </h1>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {servers.map((server) => (
          <div key={server.id}>
            {pendingDeleteId === server.id ? (
              <div className="px-3 py-2 rounded-md bg-destructive/10 border border-destructive/30 flex items-center justify-between gap-2">
                <span className="text-xs text-destructive truncate">Remove {server.displayName}?</span>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => handleDeleteConfirm(server.id)}
                    className="p-1 rounded text-destructive hover:bg-destructive/20"
                    title="Confirm"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setPendingDeleteId(null)}
                    className="p-1 rounded text-muted-foreground hover:bg-accent"
                    title="Cancel"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => {
                  selectServer(server.id)
                  navigate(`/server/${server.id}`)
                }}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-md flex items-center justify-between group hover:bg-accent transition-colors',
                  selectedId === server.id && 'bg-accent'
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <StatusBadge status={server.lastKnownStatus} size="sm" />
                  <span className="text-sm truncate">{server.displayName}</span>
                </div>
                <div className="opacity-0 group-hover:opacity-100 flex items-center transition-all">
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingServer(server) }}
                    className="text-muted-foreground hover:text-foreground p-0.5 rounded"
                    title="Edit server"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setPendingDeleteId(server.id) }}
                    className="text-muted-foreground hover:text-destructive p-0.5 rounded"
                    title="Delete server"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </button>
            )}
          </div>
        ))}

        {servers.length === 0 && (
          <p className="text-xs text-muted-foreground px-3 py-2">No servers yet</p>
        )}
      </nav>

      <div className="p-3 border-t border-border">
        <button
          onClick={() => setShowForm(true)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Server
        </button>
      </div>

      {showForm && (
        <ServerForm
          onClose={() => setShowForm(false)}
          onSave={(server) => {
            addServer(server)
            setShowForm(false)
            navigate(`/server/${server.id}`)
          }}
        />
      )}

      {editingServer && (
        <ServerForm
          existing={editingServer}
          onClose={() => setEditingServer(null)}
          onSave={(server) => {
            updateServer(server.id, server)
            setEditingServer(null)
          }}
        />
      )}
    </aside>
  )
}
