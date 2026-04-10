import { useState } from 'react'
import { useParams, Routes, Route, NavLink } from 'react-router-dom'
import { Trash2, AlertTriangle } from 'lucide-react'
import { useServersStore } from '../../store/servers.store'
import { StatusBadge } from './StatusBadge'
import { ServerControls } from '../control/ServerControls'
import { SettingsPanel } from '../settings/SettingsPanel'
import { LogViewer } from '../terminal/LogViewer'
import { InstallWizard } from '../install/InstallWizard'
import { UpdateWizard } from '../update/UpdateWizard'
import { ModsDropinPanel } from '../modsDropin/ModsDropinPanel'
import { useServerStatus } from '../../hooks/useServerStatus'
import { controlApi } from '../../ipc/client'
import { cn } from '../../lib/utils'
import type { ServerConfig } from '@shared/types'

const TABS = [
  { path: '', label: 'Overview' },
  { path: 'install', label: 'Install', requiresStopped: true },
  { path: 'update', label: 'Update', requiresStopped: true },
  { path: 'settings', label: 'Settings' },
  { path: 'mods', label: 'Mods' },
]

export function ServerDashboard() {
  const { id } = useParams<{ id: string }>()
  const { servers } = useServersStore()
  const server = servers.find((s) => s.id === id)

  useServerStatus(id ?? null)

  if (!server) return <div className="p-8 text-muted-foreground">Server not found.</div>

  const base = `/server/${id}`
  const isStopped = server.lastKnownStatus === 'stopped'

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">{server.displayName}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {server.ssh.username}@{server.ssh.host}:{server.ssh.port} · {server.installPath}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <StatusBadge status={server.lastKnownStatus} />
            <ServerControls serverId={server.id} status={server.lastKnownStatus} />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4">
          {TABS.map((tab) => {
            const disabled = tab.requiresStopped && !isStopped
            return (
              <NavLink
                key={tab.path}
                to={tab.path === '' ? base : `${base}/${tab.path}`}
                end={tab.path === ''}
                onClick={(e) => { if (disabled) e.preventDefault() }}
                className={({ isActive }) =>
                  cn(
                    'px-4 py-1.5 text-sm rounded-md transition-colors',
                    disabled
                      ? 'text-muted-foreground/30 cursor-not-allowed'
                      : isActive
                      ? 'bg-accent text-foreground font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  )
                }
                title={disabled ? 'Stop the server first' : undefined}
              >
                {tab.label}
              </NavLink>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <Routes>
          <Route
            index
            element={
              <div className="flex flex-col h-full overflow-hidden">
                <div className="overflow-auto shrink-0">
                  <Overview server={server} isStopped={isStopped} />
                </div>
                <div className="flex-1 overflow-hidden border-t border-border">
                  <LogViewer serverId={server.id} />
                </div>
              </div>
            }
          />
          <Route path="settings" element={<SettingsPanel serverId={server.id} status={server.lastKnownStatus} isStopped={isStopped} />} />
          <Route path="install" element={<div className="overflow-auto h-full"><InstallWizard serverId={server.id} osType={server.osType} isInstalled={server.isInstalled} hasGithubToken={!!server.githubToken} installedVersion={server.installedVersion} /></div>} />
          <Route path="update" element={<div className="overflow-auto h-full"><UpdateWizard serverId={server.id} installedVersion={server.installedVersion} /></div>} />
          <Route path="mods" element={<div className="overflow-auto h-full"><ModsDropinPanel serverId={server.id} /></div>} />
        </Routes>
      </div>
    </div>
  )
}

function Overview({ server, isStopped }: { server: ServerConfig; isStopped: boolean }) {
  const [wiping, setWiping] = useState(false)
  const [wipeConfirm, setWipeConfirm] = useState(false)
  const [wipeError, setWipeError] = useState<string | null>(null)
  const [wipeSuccess, setWipeSuccess] = useState(false)

  async function handleWipe() {
    setWiping(true)
    setWipeError(null)
    setWipeSuccess(false)
    try {
      await controlApi.wipeWorld(server.id)
      setWipeSuccess(true)
      setWipeConfirm(false)
    } catch (err) {
      setWipeError(String(err))
    } finally {
      setWiping(false)
    }
  }

  return (
    <div className="px-4 py-3 space-y-3">
      <div className="flex flex-wrap gap-2">
        <InfoCard label="Host" value={`${server.ssh.host}:${server.ssh.port}`} />
        <InfoCard label="User" value={server.ssh.username} />
        <InfoCard label="Auth" value={server.ssh.authMethod === 'password' ? 'Password' : 'Private Key'} />
        <InfoCard label="Install Path" value={server.installPath} />
        <InfoCard label="Installed" value={server.isInstalled ? 'Yes' : 'No (run Install)'} />
        {server.installedVersion && <InfoCard label="Version" value={server.installedVersion} />}
        <InfoCard label="Last Checked" value={server.lastChecked ? new Date(server.lastChecked).toLocaleTimeString() : '—'} />
      </div>

      {/* Wipe World */}
      <div className="border border-red-500/30 rounded-lg px-3 py-2.5 bg-red-500/5">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-xs font-semibold text-red-400">Wipe World — </span>
            <span className="text-xs text-muted-foreground">
              Permanently deletes the <code className="font-mono">World</code> directory and <code className="font-mono">config/JourneyMapServer</code>. Cannot be undone.
            </span>
            {wipeError && <p className="text-xs text-red-400 mt-1">{wipeError}</p>}
            {wipeSuccess && <p className="text-xs text-green-400 mt-1">World wiped successfully.</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!isStopped ? (
              <span className="text-xs text-muted-foreground/50">Stop the server first</span>
            ) : wipeConfirm ? (
              <>
                <button
                  onClick={() => setWipeConfirm(false)}
                  disabled={wiping}
                  className="px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleWipe}
                  disabled={wiping}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-500/20 border border-red-500/50 text-xs font-semibold text-red-300 hover:bg-red-500/30 disabled:opacity-50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {wiping ? 'Wiping…' : 'Yes, wipe world'}
                </button>
              </>
            ) : (
              <button
                onClick={() => { setWipeConfirm(true); setWipeSuccess(false) }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-500/10 border border-red-500/30 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Wipe World
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card border border-border rounded-md px-3 py-1.5">
      <span className="text-xs text-muted-foreground">{label}: </span>
      <span className="text-xs font-mono">{value}</span>
    </div>
  )
}
