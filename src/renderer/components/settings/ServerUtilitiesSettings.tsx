import type { ServerSettings } from '@shared/types'
import { Section } from './SettingsPanel'

type SU = ServerSettings['serverUtilities']

interface ServerUtilitiesSettingsProps {
  value: SU
  onChange: (v: SU) => void
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer py-1">
      <span className="text-sm">{label}</span>
      <div
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${checked ? 'bg-primary' : 'bg-secondary border border-border'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : ''}`}
        />
      </div>
    </label>
  )
}

export function ServerUtilitiesSettings({ value, onChange }: ServerUtilitiesSettingsProps) {
  function set(patch: Partial<SU>) {
    onChange({ ...value, ...patch })
  }

  return (
    <Section title="Server Utilities" description="serverutilities/serverutilities.cfg">
      <div className="space-y-1 divide-y divide-border">
        <Toggle
          label="Enable Backups"
          checked={value.backupsEnabled}
          onChange={(v) => set({ backupsEnabled: v })}
        />

        {value.backupsEnabled && (
          <div className="pt-2 pb-1 grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Backup Interval (minutes)</label>
              <input
                type="number"
                min={1}
                value={value.backupIntervalMinutes}
                onChange={(e) => set({ backupIntervalMinutes: parseInt(e.target.value, 10) || 60 })}
                className="input"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Max Backups to Keep</label>
              <input
                type="number"
                min={1}
                value={value.maxBackups}
                onChange={(e) => set({ maxBackups: parseInt(e.target.value, 10) || 3 })}
                className="input"
              />
            </div>
          </div>
        )}

        <Toggle
          label="Enable Ranks"
          checked={value.ranksEnabled}
          onChange={(v) => set({ ranksEnabled: v })}
        />

        <Toggle
          label="Chunk Claiming"
          checked={value.chunkClaimingEnabled}
          onChange={(v) => set({ chunkClaimingEnabled: v })}
        />

        <Toggle
          label="Chunk Loading"
          checked={value.chunkLoadingEnabled}
          onChange={(v) => set({ chunkLoadingEnabled: v })}
        />
      </div>
    </Section>
  )
}
