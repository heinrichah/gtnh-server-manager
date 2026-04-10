import { useRef, useEffect } from 'react'
import { Trash2 } from 'lucide-react'
import { useSshLog } from '../../hooks/useSshLog'
import { cn } from '../../lib/utils'
import type { SshLogEntry } from '@shared/types'

interface SshLogViewerProps {
  serverId: string
}

export function SshLogViewer({ serverId }: SshLogViewerProps) {
  const { entries, clearBuffer } = useSshLog(serverId)
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const autoScrollRef = useRef(true)

  useEffect(() => {
    if (autoScrollRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'auto' })
    }
  }, [entries])

  function handleScroll() {
    const el = containerRef.current
    if (!el) return
    autoScrollRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 50
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card">
        <span className="text-xs text-muted-foreground">{entries.length} commands</span>
        <button
          onClick={clearBuffer}
          className="ml-auto flex items-center gap-1.5 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
          title="Clear SSH log"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto bg-[#0a0f1a] p-4 font-mono text-xs space-y-2"
      >
        {entries.length === 0 && (
          <p className="text-muted-foreground">No SSH commands recorded yet.</p>
        )}
        {entries.map((entry, i) => (
          <SshLogRow key={i} entry={entry} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

function SshLogRow({ entry }: { entry: SshLogEntry }) {
  const ok = entry.exitCode === 0
  const time = new Date(entry.timestamp).toLocaleTimeString()

  return (
    <div className="border border-border/40 rounded px-3 py-2 space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground shrink-0">{time}</span>
        <span
          className={cn(
            'shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold',
            ok ? 'bg-green-900/60 text-green-400' : 'bg-red-900/60 text-red-400'
          )}
        >
          {ok ? 'OK' : entry.exitCode}
        </span>
        <span className="text-muted-foreground shrink-0">{entry.durationMs}ms</span>
      </div>
      <div className="text-green-300 break-all whitespace-pre-wrap">{entry.command}</div>
      {entry.stderr && (
        <div className="text-red-400 break-all whitespace-pre-wrap">{entry.stderr}</div>
      )}
    </div>
  )
}
