import { useEffect, useRef, useState } from 'react'
import { sshLogApi } from '../ipc/client'
import type { SshLogEntry } from '@shared/types'

const MAX_ENTRIES = 500

const sshLogBuffers = new Map<string, SshLogEntry[]>()

function getBuffer(serverId: string): SshLogEntry[] {
  if (!sshLogBuffers.has(serverId)) sshLogBuffers.set(serverId, [])
  return sshLogBuffers.get(serverId)!
}

export function useSshLog(serverId: string | null) {
  const [entries, setEntries] = useState<SshLogEntry[]>(
    serverId ? [...getBuffer(serverId)] : []
  )
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!serverId) return

    setEntries([...getBuffer(serverId)])

    cleanupRef.current = sshLogApi.onEntry((id, entry) => {
      if (id !== serverId) return
      const buf = getBuffer(id)
      buf.push(entry)
      if (buf.length > MAX_ENTRIES) buf.splice(0, buf.length - MAX_ENTRIES)
      setEntries([...buf])
    })

    return () => {
      cleanupRef.current?.()
      cleanupRef.current = null
    }
  }, [serverId])

  function clearBuffer() {
    if (serverId) sshLogBuffers.set(serverId, [])
    setEntries([])
  }

  return { entries, clearBuffer }
}
