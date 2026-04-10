import { useState, useEffect } from 'react'
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileText, Save, Loader2, RefreshCw } from 'lucide-react'
import { configsApi } from '../../ipc/client'
import type { ConfigDirEntry } from '@shared/types'
import { cn } from '../../lib/utils'

interface ConfigBrowserProps {
  serverId: string
}

const TEXT_EXTENSIONS = ['.cfg', '.properties', '.json', '.txt', '.sh', '.toml', '.yaml', '.yml', '.conf', '.xml', '.log']

function isEditable(name: string) {
  const lower = name.toLowerCase()
  return TEXT_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

// Predefined top-level directories to expose in the tree
const TREE_ROOTS: { label: string; path: string }[] = [
  { label: 'Root', path: '' },
  { label: 'config', path: 'config' },
  { label: 'serverutilities', path: 'serverutilities' },
]

// ---- File node ----

interface FileNodeProps {
  name: string
  path: string
  depth: number
  selected: boolean
  onSelect: (path: string) => void
}

function FileNode({ name, path, depth, selected, onSelect }: FileNodeProps) {
  return (
    <button
      onClick={() => onSelect(path)}
      className={cn(
        'w-full text-left flex items-center gap-1.5 py-0.5 px-2 rounded text-xs truncate hover:bg-accent/60 transition-colors',
        selected ? 'bg-accent text-foreground' : 'text-muted-foreground'
      )}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
      title={path}
    >
      <FileText className="w-3 h-3 shrink-0" />
      {name}
    </button>
  )
}

// ---- Dir node (lazy-loads children on expand) ----

interface DirNodeProps {
  serverId: string
  name: string
  path: string
  depth: number
  selectedPath: string | null
  onSelect: (path: string) => void
  defaultExpanded?: boolean
}

function DirNode({ serverId, name, path, depth, selectedPath, onSelect, defaultExpanded }: DirNodeProps) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? false)
  const [children, setChildren] = useState<ConfigDirEntry[] | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (expanded && children === null) {
      setLoading(true)
      configsApi
        .listDir(serverId, path)
        .then((entries) => {
          setChildren(
            entries.filter((e) => e.isDir || isEditable(e.name))
          )
        })
        .catch(() => setChildren([]))
        .finally(() => setLoading(false))
    }
  }, [expanded, serverId, path])

  const childPath = (childName: string) => path ? `${path}/${childName}` : childName

  return (
    <div>
      <button
        onClick={() => setExpanded((x) => !x)}
        className="w-full text-left flex items-center gap-1.5 py-0.5 px-2 rounded text-xs hover:bg-accent/60 transition-colors text-foreground"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {expanded ? (
          <ChevronDown className="w-3 h-3 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-3 h-3 shrink-0 text-muted-foreground" />
        )}
        {expanded ? (
          <FolderOpen className="w-3 h-3 shrink-0 text-yellow-500" />
        ) : (
          <Folder className="w-3 h-3 shrink-0 text-yellow-500" />
        )}
        <span className="truncate">{name}</span>
        {loading && <Loader2 className="w-2.5 h-2.5 animate-spin ml-auto shrink-0" />}
      </button>

      {expanded && children && (
        <div>
          {children.length === 0 && (
            <p className="text-xs text-muted-foreground" style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}>
              (empty)
            </p>
          )}
          {children.map((entry) =>
            entry.isDir ? (
              <DirNode
                key={entry.name}
                serverId={serverId}
                name={entry.name}
                path={childPath(entry.name)}
                depth={depth + 1}
                selectedPath={selectedPath}
                onSelect={onSelect}
              />
            ) : (
              <FileNode
                key={entry.name}
                name={entry.name}
                path={childPath(entry.name)}
                depth={depth + 1}
                selected={selectedPath === childPath(entry.name)}
                onSelect={onSelect}
              />
            )
          )}
        </div>
      )}
    </div>
  )
}

// ---- Main component ----

export function ConfigBrowser({ serverId }: ConfigBrowserProps) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState('')
  const [editedContent, setEditedContent] = useState('')
  const [loadingFile, setLoadingFile] = useState(false)
  const [saving, setSaving] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)

  const isDirty = editedContent !== fileContent

  async function openFile(path: string) {
    if (isDirty && selectedPath) {
      // Simple guard — could be a confirm dialog but keep it lightweight
    }
    setSelectedPath(path)
    setLoadingFile(true)
    setFileError(null)
    try {
      const content = await configsApi.read(serverId, path)
      setFileContent(content)
      setEditedContent(content)
    } catch (err) {
      setFileError(String(err instanceof Error ? err.message : err))
    } finally {
      setLoadingFile(false)
    }
  }

  async function handleSave() {
    if (!selectedPath) return
    setSaving(true)
    setFileError(null)
    try {
      await configsApi.write(serverId, selectedPath, editedContent)
      setFileContent(editedContent)
    } catch (err) {
      setFileError(String(err instanceof Error ? err.message : err))
    } finally {
      setSaving(false)
    }
  }

  function handleReload() {
    if (selectedPath) openFile(selectedPath)
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Tree panel */}
      <div className="w-56 shrink-0 border-r border-border overflow-y-auto py-2 bg-background">
        {TREE_ROOTS.map((root) => (
          <DirNode
            key={root.path}
            serverId={serverId}
            name={root.label}
            path={root.path}
            depth={0}
            selectedPath={selectedPath}
            onSelect={openFile}
            defaultExpanded={false}
          />
        ))}
      </div>

      {/* Editor panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedPath ? (
          <>
            {/* Toolbar */}
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card shrink-0">
              <span className="text-xs font-mono text-muted-foreground truncate flex-1">{selectedPath}</span>
              {isDirty && <span className="text-xs text-yellow-400 shrink-0">unsaved</span>}
              <button
                onClick={handleReload}
                disabled={loadingFile || saving}
                className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-40"
                title="Reload from server"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleSave}
                disabled={!isDirty || saving || loadingFile}
                className="flex items-center gap-1.5 px-3 py-1 rounded bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Save
              </button>
            </div>

            {fileError && (
              <p className="px-4 py-2 text-xs text-red-400 bg-red-500/10 border-b border-red-500/20">{fileError}</p>
            )}

            {loadingFile ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Loading…</span>
              </div>
            ) : (
              <textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                spellCheck={false}
                className="flex-1 resize-none bg-[#0a0f1a] font-mono text-xs text-green-300 p-4 focus:outline-none"
              />
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Select a file from the tree to edit it
          </div>
        )}
      </div>
    </div>
  )
}
