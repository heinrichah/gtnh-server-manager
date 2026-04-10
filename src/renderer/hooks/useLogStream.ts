import { useEffect, useRef, useState } from 'react'
import { logsApi } from '../ipc/client'
import type { LogChunk } from '@shared/types'

const MAX_LINES = 300
const FLUSH_INTERVAL_MS = 150

// Module-level buffer so lines survive navigating away and back to the Logs tab
const lineBuffers = new Map<string, LogChunk[]>()

function getBuffer(serverId: string): LogChunk[] {
  if (!lineBuffers.has(serverId)) lineBuffers.set(serverId, [])
  return lineBuffers.get(serverId)!
}

function pushToBuffer(serverId: string, chunk: LogChunk) {
  const buf = getBuffer(serverId)
  buf.push(chunk)
  if (buf.length > MAX_LINES) buf.splice(0, buf.length - MAX_LINES)
}

export function useLogStream(serverId: string | null) {
  const [lines, setLines] = useState<LogChunk[]>(serverId ? getBuffer(serverId) : [])
  const cleanupListenerRef = useRef<(() => void) | null>(null)
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRef = useRef(false)

  function scheduleFlush(id: string) {
    if (flushTimerRef.current) return
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null
      pendingRef.current = false
      setLines([...getBuffer(id)])
    }, FLUSH_INTERVAL_MS)
  }

  useEffect(() => {
    if (!serverId) return

    setLines([...getBuffer(serverId)])

    cleanupListenerRef.current = logsApi.onChunk((id, chunk) => {
      if (id !== serverId) return
      pushToBuffer(serverId, chunk)
      pendingRef.current = true
      scheduleFlush(serverId)
    })

    logsApi.start(serverId).catch(console.error)

    return () => {
      cleanupListenerRef.current?.()
      cleanupListenerRef.current = null
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current)
        flushTimerRef.current = null
      }
    }
  }, [serverId])

  function clearBuffer() {
    if (serverId) lineBuffers.set(serverId, [])
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current)
      flushTimerRef.current = null
    }
    setLines([])
  }

  return { lines, clearBuffer }
}
