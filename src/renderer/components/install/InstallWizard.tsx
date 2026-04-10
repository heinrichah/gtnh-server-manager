import { useEffect, useRef, useState } from 'react'
import { CheckCircle, XCircle, Loader2, Circle, ChevronDown, ChevronRight, RotateCcw } from 'lucide-react'
import { installApi } from '../../ipc/client'
import type { InstallStep } from '@shared/types'
import { cn } from '../../lib/utils'

interface InstallWizardProps {
  serverId: string
}

const INITIAL_STEPS: InstallStep[] = [
  { id: 'apt-update', label: 'Update package lists', status: 'pending' },
  { id: 'apt-upgrade', label: 'Upgrade packages', status: 'pending' },
  { id: 'install-java', label: 'Install Java 21, unzip & screen', status: 'pending' },
  { id: 'mkdir', label: 'Create server directory', status: 'pending' },
  { id: 'download', label: 'Download GTNH server zip', status: 'pending' },
  { id: 'unzip', label: 'Unzip server files', status: 'pending' },
  { id: 'chmod', label: 'Set script permissions', status: 'pending' },
  { id: 'eula', label: 'Accept EULA', status: 'pending' },
]

const DEFAULT_URL = 'https://downloads.gtnewhorizons.com/ServerPacks/GT_New_Horizons_2.8.1_Server_Java_17-25.zip'

// Persist install state at module level so it survives tab navigation (unmount/remount)
const installState = {
  running: false,
  steps: INITIAL_STEPS as InstallStep[],
  done: false,
}

// Watchdog: auto-reset if no progress event received for this long
const WATCHDOG_MS = 90_000

export function InstallWizard({ serverId }: InstallWizardProps) {
  // Initialise from module-level state so navigating away and back restores progress
  const [steps, setStepsState] = useState<InstallStep[]>(installState.steps)
  const [running, setRunningState] = useState(installState.running)
  const [done, setDoneState] = useState(installState.done)
  const [downloadUrl, setDownloadUrl] = useState(DEFAULT_URL)
  const [sudoPassword, setSudoPassword] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Wrappers that keep module-level state in sync
  function setSteps(s: InstallStep[] | ((prev: InstallStep[]) => InstallStep[])) {
    setStepsState((prev) => {
      const next = typeof s === 'function' ? s(prev) : s
      installState.steps = next
      return next
    })
  }
  function setRunning(v: boolean) {
    installState.running = v
    setRunningState(v)
  }
  function setDone(v: boolean) {
    installState.done = v
    setDoneState(v)
  }

  function resetWatchdog() {
    if (watchdogRef.current) clearTimeout(watchdogRef.current)
    watchdogRef.current = setTimeout(() => {
      if (installState.running) {
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
    const cleanup = installApi.onProgress((step) => {
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

      // Detect completion: last step succeeded
      if (step.id === INITIAL_STEPS[INITIAL_STEPS.length - 1].id && step.status === 'success') {
        setRunning(false)
        setDone(true)
        if (watchdogRef.current) clearTimeout(watchdogRef.current)
      }
    })

    return () => {
      cleanup()
      if (watchdogRef.current) clearTimeout(watchdogRef.current)
    }
  }, [])

  async function handleStart() {
    setSteps(INITIAL_STEPS)
    setRunning(true)
    setDone(false)
    resetWatchdog()
    try {
      await installApi.start(serverId, downloadUrl, sudoPassword || undefined)
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
        <h3 className="font-semibold mb-1">Server Installation</h3>
        <p className="text-sm text-muted-foreground">
          This will install GTNH on the remote server via SSH. Make sure you have sudo access.
        </p>
      </div>

      <div>
        <label className="text-xs text-muted-foreground block mb-1">Download URL</label>
        <input
          value={downloadUrl}
          onChange={(e) => setDownloadUrl(e.target.value)}
          disabled={running}
          className="input disabled:opacity-50"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Get the latest server zip URL from{' '}
          <span className="text-primary">downloads.gtnewhorizons.com</span>
        </p>
      </div>

      <div>
        <label className="text-xs text-muted-foreground block mb-1">
          Sudo Password <span className="text-muted-foreground/60">(leave blank if running as root)</span>
        </label>
        <input
          type="password"
          value={sudoPassword}
          onChange={(e) => setSudoPassword(e.target.value)}
          disabled={running}
          placeholder="Required if SSH user is not root"
          className="input disabled:opacity-50"
        />
      </div>

      {/* Step list */}
      <div className="space-y-2">
        {steps.map((step) => (
          <div key={step.id} className="bg-card border border-border rounded-lg overflow-hidden">
            <button
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/30 transition-colors"
              onClick={() => step.output && setExpandedId(expandedId === step.id ? null : step.id)}
            >
              <StepIcon status={step.status} />
              <span className={cn('flex-1 text-sm', step.status === 'error' && 'text-red-400')}>
                {step.label}
              </span>
              {step.output && (
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
        ))}
      </div>

      {done && allSuccess && (
        <div className="flex items-center gap-2 text-green-400 text-sm">
          <CheckCircle className="w-4 h-4" />
          Installation complete! Go to the Overview tab and click Start.
        </div>
      )}

      {hasError && (
        <div className="flex items-center gap-2 text-red-400 text-sm">
          <XCircle className="w-4 h-4" />
          Installation failed. Check the step output above for details.
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={handleStart}
          disabled={running}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {running && <Loader2 className="w-4 h-4 animate-spin" />}
          {running ? 'Installing…' : done ? 'Reinstall' : 'Start Installation'}
        </button>

        {running && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-accent"
            title="Force reset if the installation appears stuck"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        )}
      </div>
    </div>
  )
}

function StepIcon({ status }: { status: InstallStep['status'] }) {
  if (status === 'success') return <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
  if (status === 'error') return <XCircle className="w-4 h-4 text-red-500 shrink-0" />
  if (status === 'running') return <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
  return <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
}
