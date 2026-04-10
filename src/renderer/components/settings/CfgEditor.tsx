import { useState, useEffect, useMemo } from 'react'
import { Save, Loader2, RefreshCw, Search } from 'lucide-react'
import { configsApi } from '../../ipc/client'
import { parseCfgLines, serializeCfgLines } from '@shared/cfg-parser'
import type { CfgLine } from '@shared/cfg-parser'
import { cn } from '../../lib/utils'

interface CfgEditorProps {
  serverId: string
  filePath: string  // relative to server-files
  isStopped: boolean
}

interface PropertyItem {
  lineIdx: number
  typePrefix: string
  key: string
  value: string
  section: string
}

const TYPE_LABELS: Record<string, string> = {
  B: 'bool', I: 'int', D: 'double', S: 'str', F: 'float', L: 'long',
}

export function CfgEditor({ serverId, filePath, isStopped }: CfgEditorProps) {
  const [lines, setLines] = useState<CfgLine[]>([])
  const [savedLines, setSavedLines] = useState<CfgLine[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  async function load() {
    setLoading(true)
    setError(null)
    setSearch('')
    try {
      const content = await configsApi.read(serverId, filePath)
      const parsed = parseCfgLines(content)
      setLines(parsed)
      setSavedLines(parsed)
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [serverId, filePath])

  function updateValue(lineIdx: number, newValue: string) {
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== lineIdx) return l
        if (l.type === 'gt_property' || l.type === 'simple_property') return { ...l, value: newValue }
        return l
      })
    )
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const content = serializeCfgLines(lines)
      await configsApi.write(serverId, filePath, content, computeChangedFields(savedLines, lines))
      setSavedLines(lines)
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err))
    } finally {
      setSaving(false)
    }
  }

  const isDirty = serializeCfgLines(lines) !== serializeCfgLines(savedLines)

  function computeChangedFields(saved: CfgLine[], current: CfgLine[]): Record<string, string> {
    const toMap = (ls: CfgLine[]) => new Map(
      ls.filter((l): l is Extract<CfgLine, { type: 'gt_property' | 'simple_property' }> =>
        l.type === 'gt_property' || l.type === 'simple_property'
      ).map(l => [l.key, l.value])
    )
    const savedMap = toMap(saved)
    const changed: Record<string, string> = {}
    for (const [k, v] of toMap(current)) {
      if (savedMap.get(k) !== v) changed[k] = v
    }
    return changed
  }

  // Build flat list of properties with section context
  const allProperties = useMemo((): PropertyItem[] => {
    let section = ''
    const items: PropertyItem[] = []
    lines.forEach((line, idx) => {
      if (line.type === 'section_open') { section = line.name; return }
      if (line.type === 'gt_property' || line.type === 'simple_property') {
        items.push({ lineIdx: idx, typePrefix: line.typePrefix.replace(':', ''), key: line.key, value: line.value, section })
      }
    })
    return items
  }, [lines])

  const filtered = useMemo(() => {
    if (!search) return allProperties
    const q = search.toLowerCase()
    return allProperties.filter(
      (p) => p.key.toLowerCase().includes(q) || p.value.toLowerCase().includes(q) || p.section.toLowerCase().includes(q)
    )
  }, [allProperties, search])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Parsing…</span>
      </div>
    )
  }

  if (error && lines.length === 0) {
    return (
      <div className="p-4">
        <p className="text-sm text-red-400">{error}</p>
        <button onClick={load} className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline">
          <RefreshCw className="w-3 h-3" /> Retry
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
            placeholder="Filter keys, values or sections…"
            className="bg-transparent text-xs focus:outline-none flex-1"
          />
        </div>
        <span className="text-xs text-muted-foreground shrink-0">{filtered.length} / {allProperties.length}</span>
        {isDirty && <span className="text-xs text-yellow-400 shrink-0">unsaved</span>}
        {!isStopped && <span className="text-xs text-muted-foreground/50 shrink-0">stop server to save</span>}
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
          disabled={!isDirty || saving || !isStopped}
          className="flex items-center gap-1.5 px-3 py-1 rounded bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Save
        </button>
      </div>

      {error && (
        <p className="px-4 py-2 text-xs text-red-400 bg-red-500/10 border-b border-red-500/20">{error}</p>
      )}

      {/* Property table */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No matching properties.</p>
        ) : (
          <PropertyTable items={filtered} onUpdate={updateValue} />
        )}
      </div>
    </div>
  )
}

function PropertyTable({ items, onUpdate }: { items: PropertyItem[]; onUpdate: (idx: number, val: string) => void }) {
  let lastSection = ''

  return (
    <table className="w-full text-xs">
      <tbody>
        {items.map((prop) => {
          const showSection = prop.section !== lastSection
          lastSection = prop.section
          return [
            showSection && prop.section && (
              <tr key={`section-${prop.section}-${prop.lineIdx}`}>
                <td colSpan={3} className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                  {prop.section}
                </td>
              </tr>
            ),
            <tr key={prop.lineIdx} className="border-b border-border/40 hover:bg-accent/30">
              {/* Type badge */}
              <td className="pl-4 pr-2 py-2 w-12 align-middle">
                {prop.typePrefix && (
                  <span className={cn(
                    'text-[10px] font-mono px-1 py-0.5 rounded',
                    prop.typePrefix === 'B' ? 'bg-blue-900/50 text-blue-300' :
                    prop.typePrefix === 'I' || prop.typePrefix === 'L' ? 'bg-orange-900/50 text-orange-300' :
                    prop.typePrefix === 'D' || prop.typePrefix === 'F' ? 'bg-purple-900/50 text-purple-300' :
                    'bg-secondary text-muted-foreground'
                  )}>
                    {TYPE_LABELS[prop.typePrefix] ?? prop.typePrefix.toLowerCase()}
                  </span>
                )}
              </td>
              {/* Key */}
              <td className="px-2 py-2 font-mono text-muted-foreground align-middle w-2/5 select-all">
                {prop.key}
              </td>
              {/* Value input */}
              <td className="px-4 py-2 align-middle">
                <ValueInput
                  typePrefix={prop.typePrefix}
                  value={prop.value}
                  onChange={(val) => onUpdate(prop.lineIdx, val)}
                />
              </td>
            </tr>,
          ]
        })}
      </tbody>
    </table>
  )
}

function ValueInput({ typePrefix, value, onChange }: { typePrefix: string; value: string; onChange: (v: string) => void }) {
  if (typePrefix === 'B') {
    const checked = value.trim().toLowerCase() === 'true'
    return (
      <button
        onClick={() => onChange(checked ? 'false' : 'true')}
        className={cn(
          'w-10 h-5 rounded-full transition-colors shrink-0 relative',
          checked ? 'bg-primary' : 'bg-secondary border border-border'
        )}
        title={checked ? 'true' : 'false'}
      >
        <span className={cn(
          'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200',
          checked ? 'left-[22px]' : 'left-0.5'
        )} />
      </button>
    )
  }

  if (typePrefix === 'I' || typePrefix === 'L') {
    return (
      <input
        type="number"
        step="1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent font-mono focus:outline-none focus:bg-accent/20 rounded px-1 -mx-1"
      />
    )
  }

  if (typePrefix === 'D' || typePrefix === 'F') {
    return (
      <input
        type="number"
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent font-mono focus:outline-none focus:bg-accent/20 rounded px-1 -mx-1"
      />
    )
  }

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-transparent font-mono focus:outline-none focus:bg-accent/20 rounded px-1 -mx-1"
    />
  )
}
