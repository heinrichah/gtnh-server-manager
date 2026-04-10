import { useEffect, useRef, useState } from 'react'
import { Trash2, AlertTriangle, Send } from 'lucide-react'
import { useLogStream } from '../../hooks/useLogStream'
import { controlApi } from '../../ipc/client'
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
  const fmlPromptedRef = useRef(false)
  const fmlBaselineRef = useRef(-1)
  const [fmlPrompt, setFmlPrompt] = useState(false)
  const [fmlBusy, setFmlBusy] = useState(false)
  const [consoleInput, setConsoleInput] = useState('')
  const [consoleSending, setConsoleSending] = useState(false)

  // Capture baseline line count once lines are first populated
  useEffect(() => {
    if (fmlBaselineRef.current === -1 && lines.length > 0) {
      fmlBaselineRef.current = lines.length
    }
  }, [lines])

  // Detect /fml confirm only in lines received after the baseline — only prompt once per session
  useEffect(() => {
    if (fmlPromptedRef.current) return
    const baseline = fmlBaselineRef.current
    if (baseline === -1) return
    const triggered = lines.slice(baseline).some((c) => c.data.includes('/fml confirm'))
    if (triggered) {
      fmlPromptedRef.current = true
      setFmlPrompt(true)
    }
  }, [lines])

  // Reset prompt and baseline when server changes
  useEffect(() => {
    fmlPromptedRef.current = false
    fmlBaselineRef.current = -1
    setFmlPrompt(false)
  }, [serverId])

  async function sendConsoleCommand(text: string) {
    const cmd = text.trim()
    if (!cmd) return
    setConsoleSending(true)
    try {
      await controlApi.send(serverId, cmd)
      setConsoleInput('')
    } finally {
      setConsoleSending(false)
    }
  }

  async function handleFmlConfirm() {
    setFmlBusy(true)
    try {
      await controlApi.send(serverId, '/fml confirm')
    } finally {
      setFmlBusy(false)
      setFmlPrompt(false)
    }
  }

  async function handleFmlStop() {
    setFmlBusy(true)
    try {
      await controlApi.stop(serverId)
    } finally {
      setFmlBusy(false)
      setFmlPrompt(false)
    }
  }

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

      {fmlPrompt && (
        <div className="flex items-start gap-3 px-4 py-3 border-b border-yellow-500/30 bg-yellow-500/10 text-yellow-300 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">Missing mods or items detected</p>
            <p className="text-xs text-yellow-300/70 mt-0.5">
              FML is requesting confirmation to continue with missing entries. Run <code className="font-mono">/fml confirm</code> to override and force startup, or stop the server and fix the issue manually.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleFmlConfirm}
              disabled={fmlBusy}
              className="px-3 py-1 rounded-md bg-yellow-500/20 border border-yellow-500/40 text-xs font-medium hover:bg-yellow-500/30 disabled:opacity-50 transition-colors"
            >
              Run /fml confirm
            </button>
            <button
              onClick={handleFmlStop}
              disabled={fmlBusy}
              className="px-3 py-1 rounded-md bg-red-500/20 border border-red-500/40 text-xs font-medium text-red-300 hover:bg-red-500/30 disabled:opacity-50 transition-colors"
            >
              Stop server
            </button>
            <button
              onClick={() => setFmlPrompt(false)}
              disabled={fmlBusy}
              className="px-3 py-1 rounded-md text-xs font-medium text-yellow-300/50 hover:text-yellow-300/80 disabled:opacity-50 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

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

      <div className="flex items-center gap-2 px-3 py-2 border-t border-border bg-card">
        <span className="text-muted-foreground/50 font-mono text-xs select-none">{'>'}</span>
        <input
          type="text"
          value={consoleInput}
          onChange={(e) => setConsoleInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') sendConsoleCommand(consoleInput) }}
          placeholder="Send command to server console…"
          disabled={consoleSending}
          className="flex-1 bg-transparent font-mono text-xs text-green-300 placeholder:text-muted-foreground/40 outline-none disabled:opacity-50"
        />
        <button
          onClick={() => sendConsoleCommand(consoleInput)}
          disabled={consoleSending || !consoleInput.trim()}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30"
          title="Send command"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
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

  const time = new Date(chunk.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })

  return (
    <div className={cn('leading-5 whitespace-pre-wrap break-all flex gap-2', color)}>
      <span className="text-muted-foreground/50 shrink-0 select-none">{time}</span>
      <span>{chunk.data}</span>
    </div>
  )
}
