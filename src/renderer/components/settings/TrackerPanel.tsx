import { useEffect, useState } from 'react'
import { Trash2, RefreshCw, Loader2, RotateCcw } from 'lucide-react'
import { trackerApi } from '../../ipc/client'
import type { TrackerState } from '@shared/types'
import { cn } from '../../lib/utils'

interface TrackerPanelProps {
  serverId: string
}

export function TrackerPanel({ serverId }: TrackerPanelProps) {
  const [state, setState] = useState<TrackerState | null>(null)
  const [loading, setLoading] = useState(true)
  const [removingPath, setRemovingPath] = useState<string | null>(null)
  const [reapplying, setReapplying] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setState(await trackerApi.read(serverId))
      setSelected(new Set())
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [serverId])

  async function handleRemove(relPath: string) {
    setRemovingPath(relPath)
    try {
      setState(await trackerApi.remove(serverId, relPath))
      setSelected((prev) => { const s = new Set(prev); s.delete(relPath); return s })
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err))
    } finally {
      setRemovingPath(null)
    }
  }

  async function handleReapply(relPaths: string[]) {
    setReapplying(new Set(relPaths))
    setError(null)
    try {
      await trackerApi.reapply(serverId, relPaths)
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err))
    } finally {
      setReapplying(new Set())
    }
  }

  function toggleSelect(relPath: string) {
    setSelected((prev) => {
      const s = new Set(prev)
      s.has(relPath) ? s.delete(relPath) : s.add(relPath)
      return s
    })
  }

  function toggleSelectAll(paths: string[]) {
    setSelected((prev) => prev.size === paths.length ? new Set() : new Set(paths))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 gap-2 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        Reading state file…
      </div>
    )
  }

  const entries = state ? Object.entries(state.changes) : []
  const allPaths = entries.map(([p]) => p)

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">Tracked Changes</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Config fields modified through this tool — stored in{' '}
            <code className="bg-secondary px-1 rounded">gtnh-manager-state.json</code>{' '}
            at the install root for re-application after a server update.
          </p>
        </div>
        <div className="flex items-center gap-1">
          {selected.size > 0 && (
            <button
              onClick={() => handleReapply([...selected])}
              disabled={reapplying.size > 0}
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50"
            >
              {reapplying.size > 0 ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
              Re-apply {selected.size > 1 ? `(${selected.size})` : ''}
            </button>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">
          No changes tracked yet. Files edited through the Config Browser or server.properties editor will appear here.
        </p>
      ) : (
        <>
          {entries.length > 1 && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selected.size === allPaths.length}
                onChange={() => toggleSelectAll(allPaths)}
                className="rounded"
                title="Select all"
              />
              <span className="text-xs text-muted-foreground">Select all</span>
            </div>
          )}

          <div className="space-y-2">
            {entries.map(([relPath, change]) => {
              const isReapplying = reapplying.has(relPath)
              const isRemoving = removingPath === relPath
              const isSelected = selected.has(relPath)

              return (
                <div
                  key={relPath}
                  className={cn(
                    'flex items-start gap-3 bg-card border rounded-lg px-4 py-3',
                    isSelected ? 'border-primary/50' : 'border-border'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(relPath)}
                    className="mt-0.5 shrink-0 rounded"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-mono truncate">{relPath}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(change.changedAt).toLocaleString()}
                      {' · '}
                      {Object.keys(change.fields).length} field{Object.keys(change.fields).length !== 1 ? 's' : ''}
                    </p>
                    {Object.keys(change.fields).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {Object.entries(change.fields).map(([k, v]) => (
                          <span key={k} className="text-[10px] font-mono bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">
                            {k}={v}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleReapply([relPath])}
                      disabled={isReapplying || isRemoving}
                      className="p-1.5 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 disabled:opacity-50"
                      title="Re-apply these field values to the current file on the server"
                    >
                      {isReapplying
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <RotateCcw className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleRemove(relPath)}
                      disabled={isRemoving || isReapplying}
                      className="p-1.5 rounded text-muted-foreground hover:text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                      title="Remove from tracking (does not revert the file)"
                    >
                      {isRemoving
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {state && entries.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Last updated: {new Date(state.lastUpdated).toLocaleString()}
        </p>
      )}
    </div>
  )
}
