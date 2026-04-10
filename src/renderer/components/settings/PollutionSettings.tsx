import { Section } from './SettingsPanel'

interface PollutionSettingsProps {
  value: { activated: boolean }
  onChange: (v: { activated: boolean }) => void
}

export function PollutionSettings({ value, onChange }: PollutionSettingsProps) {
  return (
    <Section title="Pollution" description="config/GregTech/Pollution.cfg">
      <label className="flex items-center gap-3 cursor-pointer">
        <div
          onClick={() => onChange({ activated: !value.activated })}
          className={`relative w-10 h-5 rounded-full transition-colors ${value.activated ? 'bg-primary' : 'bg-secondary border border-border'}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${value.activated ? 'translate-x-5' : ''}`}
          />
        </div>
        <span className="text-sm">
          Pollution {value.activated ? 'Enabled' : 'Disabled'}
        </span>
      </label>
      <p className="mt-2 text-xs text-muted-foreground">
        When disabled, industrial pollution does not accumulate in the world.
      </p>
    </Section>
  )
}
