import { useEffect, useRef, useState } from 'react'
import { CheckCircle, XCircle, Loader2, Circle, ChevronDown, ChevronRight, RotateCcw } from 'lucide-react'
import { updateApi, githubApi, serversApi } from '../../ipc/client'
import type { InstallStep, GithubArtifact } from '@shared/types'
import { cn } from '../../lib/utils'
import { useServersStore } from '../../store/servers.store'

interface UpdateWizardProps {
  serverId: string
  installedVersion?: string
}

const INITIAL_STEPS: InstallStep[] = [
  { id: 'backup', label: 'Back up server files', status: 'pending' },
  { id: 'clean', label: 'Remove old mod files', status: 'pending' },
  { id: 'download', label: 'Download new version', status: 'pending' },
  { id: 'unzip', label: 'Extract archive', status: 'pending' },
  { id: 'apply', label: 'Apply new files', status: 'pending' },
  { id: 'restore-journeymap', label: 'Restore JourneyMap config', status: 'pending' },
  { id: 'chmod', label: 'Set permissions', status: 'pending' },
  { id: 'dropin-mods', label: 'Apply drop-in mods', status: 'pending' },
  { id: 'cleanup', label: 'Clean up temp files', status: 'pending' },
]

interface ServerUpdateState { running: boolean; steps: InstallStep[]; done: boolean }

const updateStates = new Map<string, ServerUpdateState>()

function storageKey(serverId: string) { return `gtnh-update-state-${serverId}` }

function getUpdateState(serverId: string): ServerUpdateState {
  if (!updateStates.has(serverId)) {
    try {
      const raw = localStorage.getItem(storageKey(serverId))
      if (raw) {
        const parsed = JSON.parse(raw) as ServerUpdateState
        updateStates.set(serverId, { ...parsed, running: false })
      } else {
        updateStates.set(serverId, { running: false, steps: INITIAL_STEPS, done: false })
      }
    } catch {
      updateStates.set(serverId, { running: false, steps: INITIAL_STEPS, done: false })
    }
  }
  return updateStates.get(serverId)!
}

function saveUpdateState(serverId: string) {
  try {
    const state = updateStates.get(serverId)
    if (!state) return
    const slim = { ...state, steps: state.steps.map(({ output: _o, ...s }) => s) }
    localStorage.setItem(storageKey(serverId), JSON.stringify(slim))
  } catch { /* ignore quota errors */ }
}

const WATCHDOG_MS = 90_000

export function UpdateWizard({ serverId, installedVersion }: UpdateWizardProps) {
  const { updateServer } = useServersStore()
  const serverState = getUpdateState(serverId)

  const [steps, setStepsState] = useState<InstallStep[]>(serverState.steps)
  const [running, setRunningState] = useState(serverState.running)
  const [done, setDoneState] = useState(serverState.done)
  const [downloadUrl, setDownloadUrl] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [artifacts, setArtifacts] = useState<GithubArtifact[] | null>(null)
  const [loadingArtifacts, setLoadingArtifacts] = useState(false)
  const [artifactError, setArtifactError] = useState<string | null>(null)
  const [showArtifacts, setShowArtifacts] = useState(false)
  const [artifactSearch, setArtifactSearch] = useState('')
  const [selectedArtifactName, setSelectedArtifactName] = useState<string | undefined>()

  async function loadArtifacts() {
    setLoadingArtifacts(true)
    setArtifactError(null)
    try {
      const list = await githubApi.listArtifacts(serverId)
      setArtifacts(list)
      setShowArtifacts(true)
    } catch (err) {
      setArtifactError(String(err instanceof Error ? err.message : err))
    } finally {
      setLoadingArtifacts(false)
    }
  }

  function selectArtifact(artifact: GithubArtifact) {
    setDownloadUrl(artifact.archive_download_url)
    setSelectedArtifactName(artifact.name)
    setShowArtifacts(false)
  }

  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function setSteps(s: InstallStep[] | ((prev: InstallStep[]) => InstallStep[])) {
    setStepsState((prev) => {
      const next = typeof s === 'function' ? s(prev) : s
      getUpdateState(serverId).steps = next
      saveUpdateState(serverId)
      return next
    })
  }
  function setRunning(v: boolean) {
    getUpdateState(serverId).running = v
    saveUpdateState(serverId)
    setRunningState(v)
  }
  function setDone(v: boolean) {
    getUpdateState(serverId).done = v
    saveUpdateState(serverId)
    setDoneState(v)
  }

  function resetWatchdog() {
    if (watchdogRef.current) clearTimeout(watchdogRef.current)
    watchdogRef.current = setTimeout(() => {
      if (getUpdateState(serverId).running) {
        setRunning(false)
        setSteps((prev) =>
          prev.map((s) => (s.status === 'running' ? { ...s, status: 'error', output: 'Timed out — no response from server.' } : s))
        )
      }
    }, WATCHDOG_MS)
  }

  function handleReset() {
    if (watchdogRef.current) clearTimeout(watchdogRef.current)
    setRunning(false)
    setDone(false)
    setSteps(INITIAL_STEPS)
  }

  useEffect(() => {
    const s = getUpdateState(serverId)
    setStepsState(s.steps)
    setRunningState(s.running)
    setDoneState(s.done)
  }, [serverId])

  useEffect(() => {
    const cleanup = updateApi.onProgress((step) => {
      if (step.id === '__error__') {
        setRunning(false)
        if (watchdogRef.current) clearTimeout(watchdogRef.current)
        return
      }
      resetWatchdog()
      setSteps((prev) => {
        const idx = prev.findIndex((s) => s.id === step.id)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = step
          return next
        }
        return prev
      })

      if (step.status === 'error') {
        setRunning(false)
        if (watchdogRef.current) clearTimeout(watchdogRef.current)
      }

      if (step.id === INITIAL_STEPS[INITIAL_STEPS.length - 1].id && step.status === 'success') {
        setRunning(false)
        setDone(true)
        if (watchdogRef.current) clearTimeout(watchdogRef.current)
        serversApi.list().then((servers) => {
          const updated = servers.find((s) => s.id === serverId)
          if (updated) updateServer(serverId, updated)
        }).catch(console.error)
      }
    })

    return () => {
      cleanup()
      if (watchdogRef.current) clearTimeout(watchdogRef.current)
    }
  }, [])

  async function handleStart() {
    if (!downloadUrl.trim()) return
    setSteps(INITIAL_STEPS)
    setRunning(true)
    setDone(false)
    resetWatchdog()
    try {
      await updateApi.start(serverId, downloadUrl, selectedArtifactName)
    } catch (err) {
      setRunning(false)
      if (watchdogRef.current) clearTimeout(watchdogRef.current)
      setSteps((prev) =>
        prev.map((s, i) => i === 0 ? { ...s, status: 'error', output: String(err instanceof Error ? err.message : err) } : s)
      )
    }
  }

  const allSuccess = steps.every((s) => s.status === 'success')
  const hasError = steps.some((s) => s.status === 'error')

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h3 className="font-semibold mb-1">Update Server</h3>
        <p className="text-sm text-muted-foreground">
          Downloads a new version and applies it while preserving world data and JourneyMap config. A backup is created automatically.
        </p>
      </div>

      {installedVersion && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-accent/40 border border-border text-sm">
          <span className="text-muted-foreground shrink-0">Currently installed:</span>
          <span className="font-mono text-xs truncate">{installedVersion}</span>
        </div>
      )}

      <div>
        <label className="text-xs text-muted-foreground block mb-1">Download URL</label>
        <div className="flex gap-2">
          <input
            value={downloadUrl}
            onChange={(e) => setDownloadUrl(e.target.value)}
            disabled={running}
            placeholder="https://downloads.gtnewhorizons.com/… or GitHub artifact URL"
            className="input disabled:opacity-50 flex-1"
          />
          <button
            onClick={loadArtifacts}
            disabled={running || loadingArtifacts}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-50 shrink-0"
          >
            {loadingArtifacts ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            Browse artifacts
          </button>
        </div>
        {artifactError && (
          <p className="text-xs text-red-400 mt-1">{artifactError}</p>
        )}
        {showArtifacts && artifacts && (
          <div className="mt-2 border border-border rounded-md overflow-hidden">
            <div className="p-2 border-b border-border">
              <input
                autoFocus
                value={artifactSearch}
                onChange={(e) => setArtifactSearch(e.target.value)}
                placeholder="Search artifacts…"
                className="input py-1 text-xs"
              />
            </div>
            {artifacts.length === 0 ? (
              <p className="text-xs text-muted-foreground p-3">No artifacts found.</p>
            ) : (
              <div className="max-h-56 overflow-y-auto divide-y divide-border">
                {artifacts.filter((a) => a.name.toLowerCase().includes('server') && a.name.toLowerCase().includes(artifactSearch.toLowerCase())).map((a) => (
                  <button
                    key={a.id}
                    onClick={() => selectArtifact(a)}
                    disabled={a.expired}
                    className="w-full text-left px-3 py-2 hover:bg-accent/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-xs font-medium truncate">{a.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {(a.size_in_bytes / 1024 / 1024).toFixed(1)} MB
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-muted-foreground">
                        {new Date(a.created_at).toLocaleDateString()} · {a.workflow_run.head_branch}
                      </span>
                      {a.expired && <span className="text-xs text-red-400">expired</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Step list */}
      <div className="space-y-2">
        {steps.map((step) => {
          const downloadProgress = step.id === 'download' && step.status === 'running'
            ? parseDownloadProgress(step.output ?? '')
            : null
          const showExpander = step.output && step.status !== 'running'
          return (
            <div key={step.id} className="bg-card border border-border rounded-lg overflow-hidden">
              <button
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/30 transition-colors"
                onClick={() => showExpander && setExpandedId(expandedId === step.id ? null : step.id)}
              >
                <StepIcon status={step.status} />
                <span className={cn('flex-1 text-sm', step.status === 'error' && 'text-red-400')}>
                  {step.label}
                </span>
                {downloadProgress !== null && (
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="w-32 h-1.5 bg-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${downloadProgress}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-10 text-right">{downloadProgress.toFixed(0)}%</span>
                  </div>
                )}
                {showExpander && (
                  expandedId === step.id
                    ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                    : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                )}
              </button>
              {expandedId === step.id && step.output && (
                <pre className="px-4 pb-3 text-xs font-mono text-muted-foreground whitespace-pre-wrap overflow-x-auto max-h-48 overflow-y-auto border-t border-border bg-[#0a0f1a]">
                  {step.output}
                </pre>
              )}
            </div>
          )
        })}
      </div>

      {done && allSuccess && (
        <div className="flex items-center gap-2 text-green-400 text-sm">
          <CheckCircle className="w-4 h-4" />
          Update complete! Restart the server to apply the new version.
        </div>
      )}

      {hasError && (
        <div className="flex items-center gap-2 text-red-400 text-sm">
          <XCircle className="w-4 h-4" />
          Update failed. Check the step output above for details. Your backup is preserved.
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={handleStart}
          disabled={running || !downloadUrl.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {running && <Loader2 className="w-4 h-4 animate-spin" />}
          {running ? 'Updating…' : done ? 'Update Again' : 'Start Update'}
        </button>

        {running && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-accent"
            title="Force reset if the update appears stuck"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        )}
      </div>
    </div>
  )
}

function parseDownloadProgress(output: string): number | null {
  const matches = [...output.matchAll(/(\d+(?:\.\d+)?)%/g)]
  if (matches.length === 0) return null
  return parseFloat(matches[matches.length - 1][1])
}

function StepIcon({ status }: { status: InstallStep['status'] }) {
  if (status === 'success') return <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
  if (status === 'error') return <XCircle className="w-4 h-4 text-red-500 shrink-0" />
  if (status === 'running') return <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
  return <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
}
