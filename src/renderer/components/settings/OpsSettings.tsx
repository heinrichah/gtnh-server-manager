import { useEffect, useState } from 'react'
import { UserPlus, UserMinus, Loader2, RefreshCw } from 'lucide-react'
import { opsApi } from '../../ipc/client'
import type { OpsEntry } from '@shared/types'

interface OpsSettingsProps {
  serverId: string
}

export function OpsSettings({ serverId }: OpsSettingsProps) {
  const [entries, setEntries] = useState<OpsEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [addName, setAddName] = useState('')
  const [adding, setAdding] = useState(false)
  const [removingName, setRemovingName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setEntries(await opsApi.read(serverId))
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [serverId])

  async function handleAdd() {
    const name = addName.trim()
    if (!name) return
    setAdding(true)
    setError(null)
    try {
      setEntries(await opsApi.add(serverId, name))
      setAddName('')
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err))
    } finally {
      setAdding(false)
    }
  }

  async function handleRemove(name: string) {
    setRemovingName(name)
    setError(null)
    try {
      setEntries(await opsApi.remove(serverId, name))
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err))
    } finally {
      setRemovingName(null)
    }
  }

  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold text-sm">Operators</h3>
        <button
          onClick={load}
          disabled={loading}
          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent"
          title="Refresh"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <p className="text-xs text-muted-foreground mb-4">ops.json · level 4</p>

      <div className="space-y-1 mb-4 max-h-56 overflow-y-auto">
        {loading ? (
          <p className="text-xs text-muted-foreground py-2">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">No operators configured.</p>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.uuid}
              className="flex items-center justify-between px-3 py-2 rounded-md bg-secondary group"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{entry.name}</p>
                <p className="text-xs text-muted-foreground font-mono truncate">{entry.uuid}</p>
              </div>
              <button
                onClick={() => handleRemove(entry.name)}
                disabled={removingName === entry.name}
                className="ml-3 shrink-0 p-1 rounded text-muted-foreground hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
                title={`Remove ${entry.name}`}
              >
                {removingName === entry.name
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <UserMinus className="w-3.5 h-3.5" />}
              </button>
            </div>
          ))
        )}
      </div>

      <div className="flex gap-2">
        <input
          value={addName}
          onChange={(e) => setAddName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Player name"
          disabled={adding}
          className="input flex-1"
        />
        <button
          onClick={handleAdd}
          disabled={adding || !addName.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 shrink-0"
        >
          {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
          Add
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  )
}
