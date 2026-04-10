import { Server } from 'lucide-react'

export function NoServerSelected() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
      <Server className="w-16 h-16 opacity-20" />
      <div className="text-center">
        <p className="text-lg font-medium">No server selected</p>
        <p className="text-sm mt-1">Add a server using the sidebar to get started.</p>
      </div>
    </div>
  )
}
