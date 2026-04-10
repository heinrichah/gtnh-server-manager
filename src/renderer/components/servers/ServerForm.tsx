import { useState } from 'react'
import { X, Loader2, CheckCircle, XCircle } from 'lucide-react'
import { serversApi } from '../../ipc/client'
import type { ServerConfig } from '@shared/types'
import { cn } from '../../lib/utils'

interface ServerFormProps {
  onClose: () => void
  onSave: (server: ServerConfig) => void
  existing?: ServerConfig
}

const TEST_TIMEOUT_MS = 15_000

export function ServerForm({ onClose, onSave, existing }: ServerFormProps) {
  const [displayName, setDisplayName] = useState(existing?.displayName ?? '')
  const [host, setHost] = useState(existing?.ssh.host ?? '')
  const [port, setPort] = useState(String(existing?.ssh.port ?? 22))
  const [username, setUsername] = useState(existing?.ssh.username ?? 'root')
  const [authMethod, setAuthMethod] = useState<'password' | 'privateKey'>(
    existing?.ssh.authMethod ?? 'password'
  )
  const [password, setPassword] = useState('')
  const [privateKeyPath, setPrivateKeyPath] = useState(existing?.ssh.privateKeyPath ?? '')
  const [passphrase, setPassphrase] = useState('')
  const [installPath, setInstallPath] = useState(existing?.installPath ?? '/root/GTNH-Server')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function buildSshData(): ServerConfig['ssh'] {
    return {
      host,
      port: parseInt(port, 10) || 22,
      username,
      authMethod,
      ...(authMethod === 'password' && password ? { password } : {}),
      ...(authMethod === 'privateKey' ? { privateKeyPath } : {}),
      ...(passphrase ? { passphrase } : {}),
    }
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    setError('')

    // Race the test against a timeout so the button never stays stuck
    const testPromise = serversApi.testDirect(buildSshData())
    const timeoutPromise: Promise<{ ok: false; error: string }> = new Promise((resolve) =>
      setTimeout(() => resolve({ ok: false, error: `Connection timed out after ${TEST_TIMEOUT_MS / 1000}s` }), TEST_TIMEOUT_MS)
    )

    try {
      const result = await Promise.race([testPromise, timeoutPromise])
      setTestResult(result)
    } catch (err) {
      setTestResult({ ok: false, error: String(err instanceof Error ? err.message : err) })
    } finally {
      setTesting(false)
    }
  }

  async function handleSave() {
    setError('')
    setSaving(true)
    try {
      const data = {
        displayName: displayName || host,
        ssh: buildSshData(),
        installPath,
      }
      const server = existing
        ? await serversApi.update(existing.id, data)
        : await serversApi.create(data)
      onSave(server)
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err))
    } finally {
      setSaving(false)
    }
  }

  const busy = testing || saving

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-lg w-full max-w-md p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg">{existing ? 'Edit Server' : 'Add Server'}</h2>
          <button onClick={onClose} disabled={busy} className="text-muted-foreground hover:text-foreground disabled:opacity-40">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <Field label="Display Name">
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="My GTNH Server"
              disabled={busy}
              className="input"
            />
          </Field>

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Field label="SSH Host">
                <input
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="192.168.1.100"
                  disabled={busy}
                  className="input"
                />
              </Field>
            </div>
            <Field label="Port">
              <input
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="22"
                disabled={busy}
                className="input"
              />
            </Field>
          </div>

          <Field label="Username">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="root"
              disabled={busy}
              className="input"
            />
          </Field>

          <Field label="Auth Method">
            <select
              value={authMethod}
              onChange={(e) => setAuthMethod(e.target.value as 'password' | 'privateKey')}
              disabled={busy}
              className="input"
            >
              <option value="password">Password</option>
              <option value="privateKey">Private Key File</option>
            </select>
          </Field>

          {authMethod === 'password' ? (
            <Field label="Password">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={existing ? '(leave blank to keep current)' : ''}
                disabled={busy}
                className="input"
              />
            </Field>
          ) : (
            <>
              <Field label="Private Key Path">
                <input
                  value={privateKeyPath}
                  onChange={(e) => setPrivateKeyPath(e.target.value)}
                  placeholder="C:\Users\you\.ssh\id_rsa"
                  disabled={busy}
                  className="input"
                />
              </Field>
              <Field label="Passphrase (optional)">
                <input
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  disabled={busy}
                  className="input"
                />
              </Field>
            </>
          )}

          <Field label="Install Path (on server)">
            <input
              value={installPath}
              onChange={(e) => setInstallPath(e.target.value)}
              placeholder="/root/GTNH-Server"
              disabled={busy}
              className="input"
            />
          </Field>
        </div>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        {testResult && (
          <div className={cn('mt-3 flex items-center gap-2 text-sm', testResult.ok ? 'text-green-400' : 'text-red-400')}>
            {testResult.ok ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            {testResult.ok ? 'Connection successful!' : testResult.error}
          </div>
        )}

        <div className="flex gap-2 mt-5">
          <button
            onClick={handleTest}
            disabled={busy || !host}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-sm hover:bg-accent disabled:opacity-50"
          >
            {testing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {testing ? `Testing… (${TEST_TIMEOUT_MS / 1000}s timeout)` : 'Test Connection'}
          </button>
          <div className="flex-1" />
          <button
            onClick={onClose}
            disabled={busy}
            className="px-3 py-1.5 rounded-md border border-border text-sm hover:bg-accent disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={busy || !host}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-muted-foreground mb-1">{label}</label>
      {children}
    </div>
  )
}
