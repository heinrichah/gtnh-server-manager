import { useEffect, useState, useCallback } from 'react'
import { settingsApi } from '../ipc/client'
import type { ServerSettings } from '@shared/types'

export function useSettings(serverId: string | null) {
  const [settings, setSettings] = useState<ServerSettings | null>(null)
  const [saved, setSaved] = useState<ServerSettings | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isDirty = JSON.stringify(settings) !== JSON.stringify(saved)

  const load = useCallback(async () => {
    if (!serverId) return
    setLoading(true)
    setError(null)
    try {
      const s = await settingsApi.read(serverId)
      setSettings(s)
      setSaved(s)
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err))
    } finally {
      setLoading(false)
    }
  }, [serverId])

  const persist = useCallback(async () => {
    if (!serverId || !settings) return
    setSaving(true)
    setError(null)
    try {
      await settingsApi.persist(serverId, settings)
      setSaved(settings)
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err))
      throw err
    } finally {
      setSaving(false)
    }
  }, [serverId, settings])

  const update = useCallback((patch: Partial<ServerSettings>) => {
    setSettings((prev) => prev ? { ...prev, ...patch } : prev)
  }, [])

  useEffect(() => {
    if (serverId) load()
  }, [serverId, load])

  return { settings, loading, saving, error, isDirty, update, persist, reload: load }
}
