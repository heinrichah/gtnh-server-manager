import { Section } from './SettingsPanel'

interface MemorySettingsProps {
  value: { minGb: number; maxGb: number }
  onChange: (v: { minGb: number; maxGb: number }) => void
}

export function MemorySettings({ value, onChange }: MemorySettingsProps) {
  return (
    <Section title="JVM Memory" description="Allocated RAM for the server (startserver-java9.sh)">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Min Memory (GB)</label>
          <input
            type="number"
            min={1}
            max={64}
            value={value.minGb}
            onChange={(e) => onChange({ ...value, minGb: parseInt(e.target.value, 10) || 1 })}
            className="input"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Max Memory (GB)</label>
          <input
            type="number"
            min={1}
            max={64}
            value={value.maxGb}
            onChange={(e) => onChange({ ...value, maxGb: parseInt(e.target.value, 10) || 1 })}
            className="input"
          />
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Sets <code className="bg-secondary px-1 rounded">-Xms{value.minGb}G -Xmx{value.maxGb}G</code>. Recommended: match min and max.
      </p>
    </Section>
  )
}
