import { useEffect, useRef } from 'react'
import { controlApi } from '../ipc/client'
import { useServersStore } from '../store/servers.store'

const POLL_INTERVAL = 10_000 // 10 seconds

export function useServerStatus(serverId: string | null) {
  const { updateServer } = useServersStore()
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!serverId) return

    async function poll() {
      if (!serverId) return
      try {
        const status = await controlApi.status(serverId)
        updateServer(serverId, { lastKnownStatus: status, lastChecked: new Date().toISOString() })
      } catch {
        // ignore — connection might be down
      }
    }

    poll()
    timerRef.current = setInterval(poll, POLL_INTERVAL)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [serverId, updateServer])
}
