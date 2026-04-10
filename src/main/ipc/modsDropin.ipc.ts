import { ipcMain } from 'electron'
import { IPC } from '../../shared/types'
import { readDropinState, downloadMod, deleteMod, configureMod, applyDropinMods } from '../services/modsDropin.service'
import { serverFilesPath } from '../services/screen.service'
import { getServer } from '../store/store'

export function registerModsDropinHandlers() {
  ipcMain.handle(IPC.MODS_DROPIN_READ, async (_event, serverId: string) => {
    return readDropinState(serverId)
  })

  ipcMain.handle(IPC.MODS_DROPIN_DOWNLOAD, async (_event, serverId: string, url: string) => {
    return downloadMod(serverId, url)
  })

  ipcMain.handle(IPC.MODS_DROPIN_DELETE, async (_event, serverId: string, filename: string) => {
    return deleteMod(serverId, filename)
  })

  ipcMain.handle(IPC.MODS_DROPIN_APPLY, async (_event, serverId: string) => {
    const config = getServer(serverId)
    if (!config) throw new Error(`Server ${serverId} not found`)
    return applyDropinMods(serverId, serverFilesPath(config.installPath))
  })

  ipcMain.handle(IPC.MODS_DROPIN_CONFIGURE, async (
    _event,
    serverId: string,
    filename: string,
    mode: 'dropin' | 'replace',
    replaceTarget: string | null
  ) => {
    return configureMod(serverId, filename, mode, replaceTarget)
  })
}
