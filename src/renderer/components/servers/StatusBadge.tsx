import { cn } from '../../lib/utils'

interface StatusBadgeProps {
  status: 'running' | 'stopped' | 'unknown' | string
  size?: 'sm' | 'md'
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const dot = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5'

  if (status === 'running') {
    return (
      <span className="flex items-center gap-1.5">
        <span className={cn('rounded-full bg-green-500 animate-pulse', dot)} />
        {size === 'md' && <span className="text-green-400 text-sm font-medium">Running</span>}
      </span>
    )
  }
  if (status === 'stopped') {
    return (
      <span className="flex items-center gap-1.5">
        <span className={cn('rounded-full bg-red-500', dot)} />
        {size === 'md' && <span className="text-red-400 text-sm font-medium">Stopped</span>}
      </span>
    )
  }
  if (status === 'stopping') {
    return (
      <span className="flex items-center gap-1.5">
        <span className={cn('rounded-full bg-yellow-500 animate-pulse', dot)} />
        {size === 'md' && <span className="text-yellow-400 text-sm font-medium">Stopping…</span>}
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn('rounded-full bg-gray-500', dot)} />
      {size === 'md' && <span className="text-gray-400 text-sm font-medium">Unknown</span>}
    </span>
  )
}
