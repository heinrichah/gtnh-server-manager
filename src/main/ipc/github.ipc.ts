import { ipcMain } from 'electron'
import { IPC } from '../../shared/types'
import type { GithubArtifact } from '../../shared/types'
import { getServer } from '../store/store'

export function registerGithubHandlers() {
  ipcMain.handle(IPC.GITHUB_LIST_ARTIFACTS, async (_event, serverId: string) => {
    const config = getServer(serverId)
    if (!config) throw new Error(`Server ${serverId} not found`)
    if (!config.githubToken) throw new Error('No GitHub token configured for this server')

    const url = `https://api.github.com/repos/GTNewHorizons/DreamAssemblerXXL/actions/artifacts?per_page=50`
    const res = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${config.githubToken}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'gtnh-server-manager',
      },
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`GitHub API error ${res.status}: ${body}`)
    }

    const data = await res.json() as { artifacts: GithubArtifact[] }
    return data.artifacts
  })
}
