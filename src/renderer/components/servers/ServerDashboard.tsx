import { useParams, useNavigate, Routes, Route, NavLink } from 'react-router-dom'
import { useServersStore } from '../../store/servers.store'
import { StatusBadge } from './StatusBadge'
import { ServerControls } from '../control/ServerControls'
import { SettingsPanel } from '../settings/SettingsPanel'
import { LogViewer } from '../terminal/LogViewer'
import { SshLogViewer } from '../terminal/SshLogViewer'
import { InstallWizard } from '../install/InstallWizard'
import { useServerStatus } from '../../hooks/useServerStatus'
import { cn } from '../../lib/utils'

const TABS = [
  { path: '', label: 'Overview' },
  { path: 'logs', label: 'Logs' },
  { path: 'ssh-log', label: 'SSH Log' },
  { path: 'settings', label: 'Settings' },
  { path: 'install', label: 'Install' },
]

export function ServerDashboard() {
  const { id } = useParams<{ id: string }>()
  const { servers } = useServersStore()
  const server = servers.find((s) => s.id === id)

  useServerStatus(id ?? null)

  if (!server) return <div className="p-8 text-muted-foreground">Server not found.</div>

  const base = `/server/${id}`

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
          {TABS.map((tab) => (
            <NavLink
              key={tab.path}
              to={tab.path === '' ? base : `${base}/${tab.path}`}
              end={tab.path === ''}
              className={({ isActive }) =>
                cn(
                  'px-4 py-1.5 text-sm rounded-md transition-colors',
                  isActive
                    ? 'bg-accent text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                )
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
      </div>

      {/* Content — overflow-hidden so inner panels (logs, settings tree) can manage their own scroll */}
      <div className="flex-1 overflow-hidden">
        <Routes>
          <Route index element={<div className="overflow-auto h-full"><Overview server={server} /></div>} />
          <Route path="logs" element={<LogViewer serverId={server.id} />} />
          <Route path="ssh-log" element={<SshLogViewer serverId={server.id} />} />
          <Route path="settings" element={<SettingsPanel serverId={server.id} status={server.lastKnownStatus} />} />
          <Route path="install" element={<div className="overflow-auto h-full"><InstallWizard serverId={server.id} /></div>} />
        </Routes>
      </div>
    </div>
  )
}

function Overview({ server }: { server: import('@shared/types').ServerConfig }) {
  return (
    <div className="p-6 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <InfoCard label="Host" value={`${server.ssh.host}:${server.ssh.port}`} />
        <InfoCard label="User" value={server.ssh.username} />
        <InfoCard label="Auth" value={server.ssh.authMethod === 'password' ? 'Password' : 'Private Key'} />
        <InfoCard label="Install Path" value={server.installPath} />
        <InfoCard label="Installed" value={server.isInstalled ? 'Yes' : 'No (run Install)'} />
        <InfoCard label="Last Checked" value={server.lastChecked ? new Date(server.lastChecked).toLocaleTimeString() : '—'} />
      </div>
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-sm font-mono break-all">{value}</p>
    </div>
  )
}
