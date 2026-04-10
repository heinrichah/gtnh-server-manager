import { useState, useEffect, useMemo } from 'react'
import { Save, Loader2, RefreshCw, Search } from 'lucide-react'
import { configsApi } from '../../ipc/client'

interface ServerPropertiesEditorProps {
  serverId: string
}

type PropLine =
  | { type: 'comment' | 'blank'; raw: string }
  | { type: 'property'; key: string; value: string }

function parseLines(content: string): PropLine[] {
  return content.split('\n').map((line) => {
    const trimmed = line.trim()
    if (!trimmed) return { type: 'blank', raw: line }
    if (trimmed.startsWith('#')) return { type: 'comment', raw: line }
    const eq = line.indexOf('=')
    if (eq === -1) return { type: 'comment', raw: line }
    return { type: 'property', key: line.slice(0, eq), value: line.slice(eq + 1) }
  })
}

function serializeLines(lines: PropLine[]): string {
  return lines
    .map((l) => (l.type === 'property' ? `${l.key}=${l.value}` : l.raw))
    .join('\n')
}

export function ServerPropertiesEditor({ serverId }: ServerPropertiesEditorProps) {
  const [lines, setLines] = useState<PropLine[]>([])
  const [savedLines, setSavedLines] = useState<PropLine[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const content = await configsApi.read(serverId, 'server.properties')
      const parsed = parseLines(content)
      setLines(parsed)
      setSavedLines(parsed)
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [serverId])

  function updateValue(key: string, newValue: string) {
    setLines((prev) =>
      prev.map((l) => (l.type === 'property' && l.key === key ? { ...l, value: newValue } : l))
    )
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      await configsApi.write(serverId, 'server.properties', serializeLines(lines))
      setSavedLines(lines)
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err))
    } finally {
      setSaving(false)
    }
  }

  const isDirty = serializeLines(lines) !== serializeLines(savedLines)

  const properties = useMemo(
    () =>
      lines
        .filter((l): l is Extract<PropLine, { type: 'property' }> => l.type === 'property')
        .filter((l) => !search || l.key.toLowerCase().includes(search.toLowerCase()) || l.value.toLowerCase().includes(search.toLowerCase())),
    [lines, search]
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 gap-2 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        Loading server.properties…
      </div>
    )
  }

  if (error && lines.length === 0) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-400">{error}</p>
        <button onClick={load} className="mt-3 flex items-center gap-1.5 text-sm text-primary hover:underline">
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-1.5 flex-1 bg-background border border-border rounded px-2 py-1">
          <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter properties…"
            className="bg-transparent text-xs focus:outline-none flex-1"
          />
        </div>
        <span className="text-xs text-muted-foreground shrink-0">{properties.length} shown</span>
        {isDirty && <span className="text-xs text-yellow-400 shrink-0">unsaved</span>}
        <button
          onClick={load}
          disabled={loading || saving}
          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-40"
          title="Reload from server"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleSave}
          disabled={!isDirty || saving}
          className="flex items-center gap-1.5 px-3 py-1 rounded bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Save
        </button>
      </div>

      {error && (
        <p className="px-4 py-2 text-xs text-red-400 bg-red-500/10 border-b border-red-500/20">{error}</p>
      )}

      {/* Property list */}
      <div className="flex-1 overflow-y-auto">
        {properties.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No matching properties.</p>
        ) : (
          <table className="w-full text-xs">
            <tbody>
              {properties.map((prop) => (
                <tr key={prop.key} className="border-b border-border/40 hover:bg-accent/30">
                  <td className="px-4 py-2 font-mono text-muted-foreground w-1/2 align-middle select-all">
                    {prop.key}
                  </td>
                  <td className="px-4 py-2 w-1/2">
                    <input
                      value={prop.value}
                      onChange={(e) => updateValue(prop.key, e.target.value)}
                      className="w-full bg-transparent font-mono focus:outline-none focus:bg-accent/20 rounded px-1 -mx-1"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
