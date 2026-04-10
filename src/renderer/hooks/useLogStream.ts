import { useEffect, useRef, useState } from 'react'
import { logsApi } from '../ipc/client'
import type { LogChunk } from '@shared/types'

const MAX_LINES = 2000

// Module-level buffer so lines survive navigating away and back to the Logs tab
const lineBuffers = new Map<string, LogChunk[]>()

function getBuffer(serverId: string): LogChunk[] {
  if (!lineBuffers.has(serverId)) lineBuffers.set(serverId, [])
  return lineBuffers.get(serverId)!
}

function appendToBuffer(serverId: string, chunk: LogChunk): LogChunk[] {
  const buf = getBuffer(serverId)
  buf.push(chunk)
  if (buf.length > MAX_LINES) buf.splice(0, buf.length - MAX_LINES)
  return [...buf]
}

export function useLogStream(serverId: string | null) {
  const [lines, setLines] = useState<LogChunk[]>(serverId ? getBuffer(serverId) : [])
  const cleanupListenerRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!serverId) return

    // Restore buffered lines from before we navigated away
    setLines(getBuffer(serverId))

    // Register IPC listener before starting so no chunks are missed
    cleanupListenerRef.current = logsApi.onChunk((id, chunk) => {
      if (id !== serverId) return
      setLines(appendToBuffer(serverId, chunk))
    })

    // Start the tail stream (no-op if already running in main process)
    logsApi.start(serverId).catch(console.error)

    return () => {
      // Unregister the IPC listener when navigating away, but keep the
      // tail running in the main process — stopping and restarting it
      // would re-deliver the last 200 lines and duplicate the buffer.
      cleanupListenerRef.current?.()
      cleanupListenerRef.current = null
    }
  }, [serverId])

  function clearBuffer() {
    if (serverId) lineBuffers.set(serverId, [])
    setLines([])
  }

  return { lines, clearBuffer }
}
