import { useState, useEffect } from 'react'
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileText, Save, Loader2, RefreshCw } from 'lucide-react'
import { configsApi } from '../../ipc/client'
import { CfgEditor } from './CfgEditor'
import type { ConfigDirEntry } from '@shared/types'
import { cn } from '../../lib/utils'

interface ConfigBrowserProps {
  serverId: string
  isStopped: boolean
}

const TEXT_EXTENSIONS = ['.cfg', '.json', '.txt', '.sh', '.toml', '.yaml', '.yml', '.conf', '.xml', '.log']

function isEditable(name: string) {
  const lower = name.toLowerCase()
  return TEXT_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

// Predefined top-level directories to expose in the tree
const TREE_ROOTS: { label: string; path: string; fileFilter?: (name: string) => boolean; dirFilter?: (name: string) => boolean }[] = [
  { label: 'config', path: 'config', dirFilter: (name) => name.toLowerCase() !== 'properties' },
  { label: 'serverutilities', path: 'serverutilities', dirFilter: (name) => name.toLowerCase() !== 'properties' },
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
  fileFilter?: (name: string) => boolean
  dirFilter?: (name: string) => boolean
}

function DirNode({ serverId, name, path, depth, selectedPath, onSelect, defaultExpanded, fileFilter, dirFilter }: DirNodeProps) {
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
            entries
              .filter((e) => {
                if (e.isDir) return !fileFilter && (!dirFilter || dirFilter(e.name))
                if (fileFilter) return fileFilter(e.name)
                return isEditable(e.name)
              })
              .sort((a, b) => {
                if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
                return a.name.localeCompare(b.name)
              })
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
                fileFilter={fileFilter}
                dirFilter={dirFilter}
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

function isCfgFile(path: string) {
  return path.toLowerCase().endsWith('.cfg')
}

// ---- Main component ----

export function ConfigBrowser({ serverId, isStopped }: ConfigBrowserProps) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState('')
  const [editedContent, setEditedContent] = useState('')
  const [loadingFile, setLoadingFile] = useState(false)
  const [saving, setSaving] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)

  const isDirty = editedContent !== fileContent

  async function openFile(path: string) {
    setSelectedPath(path)
    if (isCfgFile(path)) return  // CfgEditor manages its own state
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
            fileFilter={root.fileFilter}
            dirFilter={root.dirFilter}
          />
        ))}
      </div>

      {/* Editor panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selectedPath && (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Select a file from the tree to edit it
          </div>
        )}

        {selectedPath && isCfgFile(selectedPath) && (
          <CfgEditor key={selectedPath} serverId={serverId} filePath={selectedPath} isStopped={isStopped} />
        )}

        {selectedPath && !isCfgFile(selectedPath) && (
          <>
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card shrink-0">
              <span className="text-xs font-mono text-muted-foreground truncate flex-1">{selectedPath}</span>
              {isDirty && <span className="text-xs text-yellow-400 shrink-0">unsaved</span>}
              {!isStopped && <span className="text-xs text-muted-foreground/50 shrink-0">stop server to save</span>}
              <button
                onClick={() => openFile(selectedPath)}
                disabled={loadingFile || saving}
                className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-40"
                title="Reload from server"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleSave}
                disabled={!isDirty || saving || loadingFile || !isStopped}
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
        )}
      </div>
    </div>
  )
}
