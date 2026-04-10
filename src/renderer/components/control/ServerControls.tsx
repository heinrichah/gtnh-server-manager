import { useState } from 'react'
import { Play, Square, Loader2, RefreshCw } from 'lucide-react'
import { controlApi } from '../../ipc/client'
import { useServersStore } from '../../store/servers.store'

interface ServerControlsProps {
  serverId: string
  status: string
}

export function ServerControls({ serverId, status }: ServerControlsProps) {
  const [loading, setLoading] = useState(false)
  const { updateServer } = useServersStore()

  async function handleStart() {
    setLoading(true)
    try {
      await controlApi.start(serverId)
      updateServer(serverId, { lastKnownStatus: 'running' })
    } catch (err) {
      alert(`Failed to start: ${err instanceof Error ? err.message : err}`)
    } finally {
      setLoading(false)
    }
  }

  async function handleStop() {
    if (!confirm('Stop the server? Players will be disconnected.')) return
    setLoading(true)
    updateServer(serverId, { lastKnownStatus: 'stopped' })
    try {
      await controlApi.stop(serverId)
    } catch (err) {
      alert(`Failed to stop: ${err instanceof Error ? err.message : err}`)
    } finally {
      setLoading(false)
    }
  }

  async function handleRefresh() {
    const s = await controlApi.status(serverId)
    updateServer(serverId, { lastKnownStatus: s, lastChecked: new Date().toISOString() })
  }

  const isRunning = status === 'running'
  const isStopping = status === 'stopping'

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleRefresh}
        title="Refresh status"
        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
      >
        <RefreshCw className="w-4 h-4" />
      </button>

      {!isRunning && !isStopping ? (
        <button
          onClick={handleStart}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          Start
        </button>
      ) : (
        <button
          onClick={handleStop}
          disabled={loading || isStopping}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-700 text-white text-sm font-medium hover:bg-red-800 disabled:opacity-50"
        >
          {loading || isStopping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" />}
          {isStopping ? 'Stopping…' : 'Stop'}
        </button>
      )}
    </div>
  )
}
