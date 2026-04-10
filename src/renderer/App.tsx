import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Shell } from './components/layout/Shell'
import { ServerDashboard } from './components/servers/ServerDashboard'
import { NoServerSelected } from './components/layout/NoServerSelected'
import { serversApi, events } from './ipc/client'
import { useServersStore } from './store/servers.store'

export default function App() {
  const { setServers, updateServer } = useServersStore()

  // Load servers on mount
  useEffect(() => {
    serversApi.list().then(setServers).catch(console.error)
  }, [setServers])

  // Listen for status change push events from main process
  useEffect(() => {
    const cleanup = events.onStatusChanged(({ id, status }) => {
      updateServer(id, { lastKnownStatus: status as ServerConfig['lastKnownStatus'] })
    })
    return cleanup
  }, [updateServer])

  return (
    <Shell>
      <Routes>
        <Route path="/" element={<NoServerSelected />} />
        <Route path="/server/:id/*" element={<ServerDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  )
}

// Local type import to avoid circular dep
type ServerConfig = { lastKnownStatus: 'running' | 'stopped' | 'unknown' }
