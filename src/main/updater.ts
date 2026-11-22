import { autoUpdater } from 'electron-updater'
import { ipcMain, BrowserWindow, shell } from 'electron'
import type { AppSettings } from '../shared/types'

/**
 * Update lifecycle wired to electron-updater, surfaced to the renderer via
 * `update:*` IPC channels. The setting controls background checks, while
 * downloads and installation are initiated by the user.
 */

const isPortable = Boolean(process.env.PORTABLE_EXECUTABLE_DIR)
let latestReleaseUrl: string | undefined

let autoUpdateEnabled = false
let manualChecks = 0
let backgroundCheck: { requestedManually: boolean } | null = null

export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available'; version: string; releaseNotes?: string; releaseUrl?: string }
  | { state: 'not-available'; version: string }
  | { state: 'downloading'; percent: number }
  | { state: 'downloaded'; version: string }
  | { state: 'error'; message: string }

let currentStatus: UpdateStatus = { state: 'idle' }

function releaseDetailsFromFeed(
  version: string,
  rawNotes?: string | null | Array<{ version: string; note: string | null }>
): { notes?: string; url: string } {
  const url = `https://github.com/CyberGems/CyberFeeds/releases/tag/v${version}`
  const notes = Array.isArray(rawNotes)
    ? rawNotes.map((release) => release.note).filter(Boolean).join('\n\n')
    : rawNotes?.trim()
  return { notes: notes || undefined, url }
}

async function fetchReleaseDetails(
  version: string,
  fallback: { notes?: string; url: string }
): Promise<{ notes?: string; url: string }> {

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
      if (typeof data?.body === 'string' && data.body.trim().length > 0) {
        return {
          notes: data.body,
          url: typeof data?.html_url === 'string' ? data.html_url : fallback.url
        }
      }
    }
  } catch (err) {
    console.warn('[Updater] Could not fetch release notes from GitHub API:', err)
  }

  return fallback
}

function broadcast(status: UpdateStatus): void {
  currentStatus = status
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('update:status', status)
  }
}

async function doCheckSilently(): Promise<void> {
  if (!autoUpdateEnabled || backgroundCheck || manualChecks > 0) return
  backgroundCheck = { requestedManually: false }
  try {
    await autoUpdater.checkForUpdates()
  } catch { /* offline / rate-limit: ignore */ }
  finally { backgroundCheck = null }
}

export function initUpdater(settings: AppSettings): void {
  autoUpdateEnabled = settings.autoUpdate
  // We manage download timing ourselves based on user confirmation.
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false

  autoUpdater.on('checking-for-update', () => broadcast({ state: 'checking' }))

  autoUpdater.on('update-available', async (info) => {
    const background = backgroundCheck
    if (background && !background.requestedManually && !autoUpdateEnabled) {
      broadcast({ state: 'idle' })
      return
    }
    const details = releaseDetailsFromFeed(info.version, info.releaseNotes)
    latestReleaseUrl = details.url
    const available: UpdateStatus = {
      state: 'available',
      version: info.version,
      releaseNotes: details.notes,
      releaseUrl: details.url
    }
    broadcast(available)

    const enriched = await fetchReleaseDetails(info.version, details)
    if (
      enriched !== details &&
      currentStatus === available &&
      (!background || background.requestedManually || autoUpdateEnabled)
    ) {
      latestReleaseUrl = enriched.url
      broadcast({ ...available, releaseNotes: enriched.notes, releaseUrl: enriched.url })
    }
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
    setTimeout(() => { void doCheckSilently() }, 8000)
  }
}

export function setAutoUpdate(enabled: boolean): void {
  autoUpdateEnabled = enabled
}

function registerUpdateIpc(): void {
  ipcMain.handle('update:check', async () => {
    manualChecks++
    if (backgroundCheck) backgroundCheck.requestedManually = true
    try {
      // Bound the check so a hung network request can't leave the renderer
      // spinning indefinitely, but allow enough time for a real check to finish.
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Update check timed out')), 20000)
      })
      const result = await Promise.race([autoUpdater.checkForUpdates(), timeoutPromise])
      const version = result?.updateInfo.version
      const details = result?.isUpdateAvailable && version
        ? releaseDetailsFromFeed(version, result.updateInfo.releaseNotes)
        : undefined
      return {
        ok: true,
        version,
        available: result?.isUpdateAvailable,
        releaseNotes: details?.notes,
        releaseUrl: details?.url,
        isPortable
      }
    } catch (err) {
      console.error('[Updater] Check failed:', err)
      return { ok: false, error: String((err as Error)?.message || err) }
    } finally {
      manualChecks--
    }
  })

  ipcMain.handle('update:download', async () => {
    if (isPortable) {
      if (latestReleaseUrl) {
        shell.openExternal(latestReleaseUrl)
      }
      return { ok: true, isPortable: true }
    }
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
    if (isPortable) {
      if (latestReleaseUrl) {
        shell.openExternal(latestReleaseUrl)
      }
      return
    }
    // Quit and install the downloaded update silently (unattended) with auto-relaunch.
    autoUpdater.quitAndInstall(true, true)
  })
}

// Exposed for potential logging hooks; referenced to satisfy noUnusedLocals.
export function isManualCheck(): boolean {
  return manualChecks > 0
}
