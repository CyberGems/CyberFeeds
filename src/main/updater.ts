import { autoUpdater } from 'electron-updater'
import { ipcMain, BrowserWindow } from 'electron'
import type { AppSettings } from '../shared/types'

/**
 * Update lifecycle wired to electron-updater, surfaced to the renderer via
 * `update:*` IPC channels. Auto-download is gated on the `autoUpdate` setting:
 * when off, an available update is reported but not fetched until the user
 * triggers it from the About modal.
 */

let autoUpdateEnabled = false
let manualCheck = false

export type UpdateStatus =
  | { state: 'checking' }
  | { state: 'available'; version: string; releaseNotes?: string; releaseUrl?: string }
  | { state: 'not-available'; version: string }
  | { state: 'downloading'; percent: number }
  | { state: 'downloaded'; version: string }
  | { state: 'error'; message: string }

async function fetchReleaseDetails(
  version: string,
  rawNotes?: string | null | Array<{ version: string; note: string | null }>
): Promise<{ notes?: string; url: string }> {
  const defaultUrl = `https://github.com/CyberGems/CyberFeeds/releases/tag/v${version}`
  let existingNotes: string | undefined
  if (typeof rawNotes === 'string' && rawNotes.trim().length > 0) {
    existingNotes = rawNotes.trim()
  } else if (Array.isArray(rawNotes)) {
    existingNotes = rawNotes
      .map((r) => r.note)
      .filter((n): n is string => Boolean(n))
      .join('\n\n')
  }

  if (existingNotes) {
    return { notes: existingNotes, url: defaultUrl }
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/CyberGems/CyberFeeds/releases/tags/v${version}`,
      {
        headers: {
          'User-Agent': 'CyberFeeds',
          Accept: 'application/vnd.github.v3+json'
        }
      }
    )
    if (res.ok) {
      const data = await res.json()
      return {
        notes: typeof data?.body === 'string' ? data.body : undefined,
        url: typeof data?.html_url === 'string' ? data.html_url : defaultUrl
      }
    }
  } catch (err) {
    console.warn('[Updater] Could not fetch release notes from GitHub API:', err)
  }

  return { url: defaultUrl }
}

function broadcast(status: UpdateStatus): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('update:status', status)
  }
}

export function initUpdater(settings: AppSettings): void {
  autoUpdateEnabled = settings.autoUpdate
  // We manage download timing ourselves based on user confirmation.
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false

  autoUpdater.on('checking-for-update', () => broadcast({ state: 'checking' }))

  autoUpdater.on('update-available', async (info) => {
    const details = await fetchReleaseDetails(info.version, info.releaseNotes)
    broadcast({
      state: 'available',
      version: info.version,
      releaseNotes: details.notes,
      releaseUrl: details.url
    })
  })

  autoUpdater.on('update-not-available', (info) => {
    broadcast({ state: 'not-available', version: info.version })
  })

  autoUpdater.on('download-progress', (p) => {
    broadcast({ state: 'downloading', percent: Math.round(p.percent) })
  })

  autoUpdater.on('update-downloaded', (info) => {
    broadcast({ state: 'downloaded', version: info.version })
  })

  autoUpdater.on('error', (err) => {
    // Suppress noise on a manual check that simply found nothing reachable.
    broadcast({ state: 'error', message: String(err?.message || err) })
  })

  registerUpdateIpc()

  // Silent check shortly after launch when auto-update is enabled.
  if (autoUpdateEnabled) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(() => {
        /* offline: ignore */
      })
    }, 8000)
  }
}

export function setAutoUpdate(enabled: boolean): void {
  autoUpdateEnabled = enabled
}

function registerUpdateIpc(): void {
  ipcMain.handle('update:check', async () => {
    manualCheck = true
    try {
      // Bound the check so a hung network request can't leave the renderer
      // spinning indefinitely, but allow enough time for a real check to finish.
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Update check timed out')), 20000)
      })
      const result = (await Promise.race([autoUpdater.checkForUpdates(), timeoutPromise])) as any
      const ver = result?.updateInfo?.version
      let details: { notes?: string; url?: string } | undefined
      if (ver) {
        details = await fetchReleaseDetails(ver, result?.updateInfo?.releaseNotes)
      }
      return {
        ok: true,
        version: ver,
        releaseNotes: details?.notes,
        releaseUrl: details?.url
      }
    } catch (err) {
      console.error('[Updater] Check failed:', err)
      return { ok: false, error: String((err as Error)?.message || err) }
    } finally {
      manualCheck = false
    }
  })

  ipcMain.handle('update:download', async () => {
    broadcast({ state: 'downloading', percent: 0 })
    try {
      await autoUpdater.downloadUpdate()
      return { ok: true }
    } catch (err) {
      console.error('[Updater] Download failed:', err)
      broadcast({ state: 'error', message: String((err as Error)?.message || err) })
      return { ok: false, error: String((err as Error)?.message || err) }
    }
  })

  ipcMain.handle('update:install', () => {
    // Quit and install the downloaded update silently (unattended) with auto-relaunch.
    autoUpdater.quitAndInstall(true, true)
  })
}

// Exposed for potential logging hooks; referenced to satisfy noUnusedLocals.
export function isManualCheck(): boolean {
  return manualCheck
}
