import { useEffect, useState } from 'react'
import { Loader2, Trash2, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
import { modsDropinApi, configsApi } from '../../ipc/client'
import type { ModDropinEntry, ModDropinState } from '@shared/types'
import { cn } from '../../lib/utils'
import { POPULAR_DROPINS } from './popularDropins'

interface ModsDropinPanelProps {
  serverId: string
}

export function ModsDropinPanel({ serverId }: ModsDropinPanelProps) {
  const [state, setState] = useState<ModDropinState | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [downloadUrl, setDownloadUrl] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  const [applying, setApplying] = useState(false)
  const [applyResult, setApplyResult] = useState<{ ok: boolean; message: string } | null>(null)

  const [configuringFilename, setConfiguringFilename] = useState<string | null>(null)

  // Tracks which popular dropin is currently downloading (by downloadUrl)
  const [popularDownloading, setPopularDownloading] = useState<string | null>(null)

  async function handlePopularDownload(downloadUrl: string) {
    setPopularDownloading(downloadUrl)
    try {
      await modsDropinApi.download(serverId, downloadUrl)
      const updated = await modsDropinApi.read(serverId)
      setState(updated)
    } catch (err) {
      console.error(err)
    } finally {
      setPopularDownloading(null)
    }
  }

  useEffect(() => {
    modsDropinApi.read(serverId)
      .then(setState)
      .catch((err) => setLoadError(String(err instanceof Error ? err.message : err)))
  }, [serverId])

  async function handleDownload() {
    if (!downloadUrl.trim()) return
    setDownloading(true)
    setDownloadError(null)
    try {
      await modsDropinApi.download(serverId, downloadUrl.trim())
      const updated = await modsDropinApi.read(serverId)
      setState(updated)
      setDownloadUrl('')
    } catch (err) {
      setDownloadError(String(err instanceof Error ? err.message : err))
    } finally {
      setDownloading(false)
    }
  }

  async function handleDelete(filename: string) {
    try {
      const updated = await modsDropinApi.delete(serverId, filename)
      setState(updated)
      if (configuringFilename === filename) setConfiguringFilename(null)
    } catch (err) {
      console.error(err)
    }
  }

  async function handleApply() {
    setApplying(true)
    setApplyResult(null)
    try {
      const output = await modsDropinApi.apply(serverId)
      const failed = output.includes('✗')
      setApplyResult({ ok: !failed, message: output })
    } catch (err) {
      setApplyResult({ ok: false, message: String(err instanceof Error ? err.message : err) })
    } finally {
      setApplying(false)
    }
  }

  function handleConfigSave(updated: ModDropinState) {
    setState(updated)
    setConfiguringFilename(null)
  }

  const mods = state ? Object.values(state.mods) : []

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h3 className="font-semibold mb-1">Drop-in Mods</h3>
        <p className="text-sm text-muted-foreground">
          Mods added here are automatically applied to <code className="font-mono text-xs">server-files/mods/</code> after every install or update.
        </p>
      </div>

      {/* Popular drop-ins */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">Popular drop-ins</p>
        <div className="space-y-2">
          {POPULAR_DROPINS.map((dropin) => {
            const alreadyAdded = state !== null && Object.values(state.mods).some(
              (m) => m.sourceUrl === dropin.downloadUrl
            )
            const isDownloading = popularDownloading === dropin.downloadUrl
            return (
              <div key={dropin.downloadUrl} className="flex items-center gap-3 px-4 py-2.5 bg-card border border-border rounded-lg">
                <span className="text-sm flex-1">{dropin.name}</span>
                {dropin.detailsUrl && (
                  <a
                    href={dropin.detailsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    title="View mod details"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                {alreadyAdded ? (
                  <span className="text-xs text-green-400 shrink-0">Added</span>
                ) : (
                  <button
                    onClick={() => handlePopularDownload(dropin.downloadUrl)}
                    disabled={isDownloading || !!popularDownloading}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-50 shrink-0"
                  >
                    {isDownloading && <Loader2 className="w-3 h-3 animate-spin" />}
                    {isDownloading ? 'Downloading…' : 'Download'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Download section */}
      <div>
        <label className="text-xs text-muted-foreground block mb-1">Add a mod — paste download URL</label>
        <div className="flex gap-2">
          <input
            value={downloadUrl}
            onChange={(e) => setDownloadUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !downloading && handleDownload()}
            disabled={downloading}
            placeholder="https://example.com/mod-1.0.jar"
            className="input disabled:opacity-50 flex-1"
          />
          <button
            onClick={handleDownload}
            disabled={downloading || !downloadUrl.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50 shrink-0"
          >
            {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            {downloading ? 'Downloading…' : 'Download'}
          </button>
        </div>
        {downloadError && (
          <p className="text-xs text-red-400 mt-1">{downloadError}</p>
        )}
      </div>

      {/* Mod list */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">
          {mods.length === 0 ? 'No drop-in mods configured.' : `${mods.length} mod${mods.length !== 1 ? 's' : ''} configured`}
        </p>

        {loadError && (
          <p className="text-xs text-red-400 mb-2">{loadError}</p>
        )}

        {mods.length > 0 && (
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={handleApply}
              disabled={applying}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50"
            >
              {applying && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {applying ? 'Applying…' : 'Apply to server now'}
            </button>
            {applyResult && (
              <pre className={cn('text-xs font-mono whitespace-pre-wrap', applyResult.ok ? 'text-green-400' : 'text-red-400')}>
                {applyResult.message}
              </pre>
            )}
          </div>
        )}

        <div className="space-y-2">
          {mods.map((mod) => (
            <ModRow
              key={mod.filename}
              serverId={serverId}
              mod={mod}
              isConfiguring={configuringFilename === mod.filename}
              onToggleConfig={() => setConfiguringFilename(configuringFilename === mod.filename ? null : mod.filename)}
              onDelete={() => handleDelete(mod.filename)}
              onSave={handleConfigSave}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

interface ModRowProps {
  serverId: string
  mod: ModDropinEntry
  isConfiguring: boolean
  onToggleConfig: () => void
  onDelete: () => void
  onSave: (state: ModDropinState) => void
}

function ModRow({ serverId, mod, isConfiguring, onToggleConfig, onDelete, onSave }: ModRowProps) {
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="text-sm font-mono flex-1 truncate">{mod.filename}</span>
        <ModeBadge mod={mod} />
        <button
          onClick={onToggleConfig}
          className={cn(
            'p-1.5 rounded-md transition-colors',
            isConfiguring
              ? 'bg-accent text-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent'
          )}
          title="Configure"
        >
          {isConfiguring ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded-md text-muted-foreground hover:text-red-400 hover:bg-accent transition-colors"
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {isConfiguring && (
        <ConfigForm
          serverId={serverId}
          mod={mod}
          onSave={onSave}
          onCancel={onToggleConfig}
        />
      )}
    </div>
  )
}

function ModeBadge({ mod }: { mod: ModDropinEntry }) {
  if (mod.mode === 'replace' && mod.replaceTarget) {
    return (
      <span className="text-xs text-amber-400 font-mono truncate max-w-[180px] shrink-0" title={`Replaces: ${mod.replaceTarget}`}>
        → {mod.replaceTarget}
      </span>
    )
  }
  return (
    <span className="text-xs text-green-400 shrink-0">Drop-in</span>
  )
}

interface ConfigFormProps {
  serverId: string
  mod: ModDropinEntry
  onSave: (state: ModDropinState) => void
  onCancel: () => void
}

function ConfigForm({ serverId, mod, onSave, onCancel }: ConfigFormProps) {
  const [mode, setMode] = useState<'dropin' | 'replace'>(mod.mode)
  const [replaceTarget, setReplaceTarget] = useState<string>(mod.replaceTarget ?? '')
  const [serverMods, setServerMods] = useState<string[] | null>(null)
  const [loadingMods, setLoadingMods] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (mode === 'replace') loadServerMods()
  }, [])

  async function loadServerMods() {
    if (serverMods !== null) return
    setLoadingMods(true)
    try {
      const entries = await configsApi.listDir(serverId, 'mods')
      setServerMods(entries.filter((e) => !e.isDir).map((e) => e.name).sort())
    } catch {
      setServerMods([])
    } finally {
      setLoadingMods(false)
    }
  }

  function handleModeChange(next: 'dropin' | 'replace') {
    setMode(next)
    if (next === 'replace') loadServerMods()
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const updated = await modsDropinApi.configure(
        serverId,
        mod.filename,
        mode,
        mode === 'replace' ? (replaceTarget || null) : null
      )
      onSave(updated)
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="px-4 pb-4 pt-1 border-t border-border space-y-3 bg-[#0a0f1a]">
      <div className="space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name={`mode-${mod.filename}`}
            checked={mode === 'dropin'}
            onChange={() => handleModeChange('dropin')}
            className="accent-primary"
          />
          <span className="text-sm">Add as new mod</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name={`mode-${mod.filename}`}
            checked={mode === 'replace'}
            onChange={() => handleModeChange('replace')}
            className="accent-primary"
          />
          <span className="text-sm">Replace existing mod</span>
        </label>
      </div>

      {mode === 'replace' && (
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Select mod to replace</label>
          {loadingMods ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading mods…
            </div>
          ) : (
            <select
              value={replaceTarget}
              onChange={(e) => setReplaceTarget(e.target.value)}
              className="w-full bg-card border border-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">— select a mod —</option>
              {(serverMods ?? []).map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving || (mode === 'replace' && !replaceTarget)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50"
        >
          {saving && <Loader2 className="w-3 h-3 animate-spin" />}
          Save
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-accent"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
