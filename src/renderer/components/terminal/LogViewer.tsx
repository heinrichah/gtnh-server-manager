import { useEffect, useRef } from 'react'
import { Trash2 } from 'lucide-react'
import { useLogStream } from '../../hooks/useLogStream'
import { cn } from '../../lib/utils'
import type { LogChunk } from '@shared/types'

interface LogViewerProps {
  serverId: string
}

export function LogViewer({ serverId }: LogViewerProps) {
  const { lines, clearBuffer } = useLogStream(serverId)
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const autoScrollRef = useRef(true)

  useEffect(() => {
    if (autoScrollRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'auto' })
    }
  }, [lines])

  function handleScroll() {
    const el = containerRef.current
    if (!el) return
    autoScrollRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 50
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card">
        <span className="text-xs text-muted-foreground">{lines.length} lines</span>
        <button
          onClick={clearBuffer}
          className="ml-auto flex items-center gap-1.5 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
          title="Clear log buffer"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto bg-[#0a0f1a] p-4 font-mono text-xs"
      >
        {lines.length === 0 && (
          <p className="text-muted-foreground">
            Waiting for log output… (server must be running and a screen session named MC must exist)
          </p>
        )}
        {lines.map((chunk, i) => (
          <LogLine key={i} chunk={chunk} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

function LogLine({ chunk }: { chunk: LogChunk }) {
  const color =
    chunk.type === 'stderr' || chunk.data.includes('[ERROR]') || chunk.data.includes('ERROR')
      ? 'text-red-400'
      : chunk.data.includes('[WARN]') || chunk.data.includes('WARN')
      ? 'text-yellow-400'
      : chunk.type === 'system'
      ? 'text-blue-400'
      : 'text-green-300'

  return (
    <div className={cn('leading-5 whitespace-pre-wrap break-all', color)}>
      {chunk.data}
    </div>
  )
}
