import { useState } from 'react'
import { ConfigBrowser } from './ConfigBrowser'
import { ServerPropertiesEditor } from './ServerPropertiesEditor'
import { WhitelistSettings } from './WhitelistSettings'
import { OpsSettings } from './OpsSettings'
import { cn } from '../../lib/utils'

interface SettingsPanelProps {
  serverId: string
  status: string
}

const TABS = [
  { id: 'configs', label: 'Config Files' },
  { id: 'server-properties', label: 'server.properties' },
  { id: 'players', label: 'Players' },
] as const

type TabId = typeof TABS[number]['id']

export function SettingsPanel({ serverId }: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('configs')

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex gap-1 px-4 pt-3 pb-0 border-b border-border shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-4 py-1.5 text-sm rounded-t-md transition-colors border-b-2 -mb-px',
              activeTab === tab.id
                ? 'border-primary text-foreground font-medium bg-accent/30'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/20'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content — full remaining height */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'configs' && <ConfigBrowser serverId={serverId} />}
        {activeTab === 'server-properties' && <ServerPropertiesEditor serverId={serverId} />}
        {activeTab === 'players' && (
          <div className="p-6 space-y-6 overflow-y-auto h-full">
            <WhitelistSettings serverId={serverId} />
            <OpsSettings serverId={serverId} />
          </div>
        )}
      </div>
    </div>
  )
}

export function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <h3 className="font-semibold text-sm mb-1">{title}</h3>
      {description && <p className="text-xs text-muted-foreground mb-4">{description}</p>}
      {children}
    </div>
  )
}
