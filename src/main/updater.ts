import { BrowserWindow, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
import { CancellationToken } from 'builder-util-runtime'
import type { ElectronHttpExecutor } from 'electron-updater/out/electronHttpExecutor'
import type { AppSettings } from '../shared/types'
import type { PendingUpdate, UpdateCheckResult } from '../shared/update'

const REPO_URL = 'https://github.com/CyberGems/CyberFeeds'
const isPortable = Boolean(process.env.PORTABLE_EXECUTABLE_DIR)
let autoUpdateEnabled = false
let currentStatus: PendingUpdate | null = null
let activeCheck: Promise<UpdateCheckResult> | null = null
let activeDownload: { token: CancellationToken; requests: Set<Electron.ClientRequest> } | null = null

function broadcast(status: PendingUpdate | null): void {
  currentStatus = status
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('update:status', status)
  }
}

function refreshReleaseNotes(version: string): void {
  void fetch(`https://api.github.com/repos/CyberGems/CyberFeeds/releases/tags/v${version}`, {
    signal: AbortSignal.timeout(10000),
    headers: { 'User-Agent': 'CyberFeeds', Accept: 'application/vnd.github.v3+json' }
  })
    .then(async (response) => {
      if (!response.ok) return undefined
      const release = await response.json()
      return typeof release?.body === 'string' && release.body.trim() ? release.body : undefined
    })
    .catch((error) => {
      console.warn('[Updater] Could not fetch release notes:', error)
      return undefined
    })
    .then((notes) => {
      if (currentStatus?.release.version === version) {
        broadcast({
          ...currentStatus,
          release: {
            ...currentStatus.release,
            releaseNotes: notes ?? currentStatus.release.releaseNotes,
            notesLoading: false
          }
        })
      }
    })
}

function checkForUpdates(): Promise<UpdateCheckResult> {
  if (currentStatus && currentStatus.state !== 'available') {
    return Promise.resolve({ ok: true, available: true, version: currentStatus.release.version })
  }
  if (activeCheck) return activeCheck

  activeCheck = autoUpdater.checkForUpdates()
    .then<UpdateCheckResult>((result) => {
      if (!result?.isUpdateAvailable) {
        broadcast(null)
        return { ok: true, available: false }
      }

      const { version, releaseNotes } = result.updateInfo
      if (currentStatus?.release.version !== version) {
        const notes = Array.isArray(releaseNotes)
          ? releaseNotes.map((release) => release.note?.trim()).filter(Boolean).join('\n\n')
          : releaseNotes?.trim()
        broadcast({
          state: 'available',
          release: {
            version,
            releaseUrl: `${REPO_URL}/releases/tag/v${version}`,
            releaseNotes: notes || undefined,
            notesLoading: !notes,
            portableUrl: isPortable
              ? `${REPO_URL}/releases/download/v${version}/CyberFeeds-${version}-portable.exe`
              : undefined
          }
        })
        // Some feeds supply an English summary in place of the bilingual body.
        if (!notes || !/<details\b/i.test(notes)) refreshReleaseNotes(version)
      }
      return { ok: true, available: true, version }
    })
    .catch<UpdateCheckResult>((error) => {
      console.warn('[Updater] Check failed:', error)
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    })
    .finally(() => { activeCheck = null })

  return activeCheck
}

function connectDownloadCancellation(): void {
  const { httpExecutor } = autoUpdater as typeof autoUpdater & { httpExecutor: ElectronHttpExecutor }
  const createRequest = httpExecutor.createRequest.bind(httpExecutor)
  httpExecutor.createRequest = (options, onResponse) => {
    const download = activeDownload
    if (!download) return createRequest(options, onResponse)

    // ClientRequest closes its writable side before the response has arrived.
    // Track the request until the response ends so cancellation can stop the transfer.
    const request = createRequest(options, (response: Electron.IncomingMessage) => {
      response.once('end', forgetRequest)
      response.once('error', forgetRequest)
      onResponse(response)
    })
    function forgetRequest(): void { download?.requests.delete(request) }

    download.requests.add(request)
    request.once('abort', forgetRequest)
    request.once('error', forgetRequest)
    if (download.token.cancelled) request.abort()
    return request
  }
}

export function initUpdater(settings: AppSettings): void {
  autoUpdateEnabled = settings.autoUpdate
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  connectDownloadCancellation()

  autoUpdater.on('download-progress', ({ percent, transferred, total }) => {
    if (currentStatus?.state === 'downloading' && !currentStatus.cancelling) {
      broadcast({ ...currentStatus, percent: Math.round(percent), transferred, total })
    }
  })
  autoUpdater.on('error', () => {
    if (currentStatus?.state === 'installing') {
      broadcast({ release: currentStatus.release, state: 'downloaded', installFailed: true })
    }
  })

  ipcMain.handle('update:get-status', () => currentStatus)
  ipcMain.handle('update:check', async () => {
    let timeout: ReturnType<typeof setTimeout> | undefined
    try {
      return await Promise.race([
        checkForUpdates(),
        new Promise<UpdateCheckResult>((resolve) => {
          timeout = setTimeout(
            () => resolve({ ok: false, error: 'Update check timed out' }),
            20000
          )
        })
      ])
    } finally {
      clearTimeout(timeout)
    }
  })

  ipcMain.handle('update:download', async (_event, version: string) => {
    // Let an in-flight check finish selecting its installer before validating the request.
    await activeCheck
    if (isPortable || currentStatus?.state !== 'available' || currentStatus.release.version !== version) {
      return
    }

    const token = new CancellationToken()
    activeDownload = { token, requests: new Set() }
    const { release } = currentStatus
    broadcast({ release, state: 'downloading', percent: 0 })
    try {
      await autoUpdater.downloadUpdate(token)
      broadcast({ release: currentStatus?.release ?? release, state: 'downloaded' })
    } catch (error) {
      if (!token.cancelled) console.error('[Updater] Download failed:', error)
      broadcast({
        release: currentStatus?.release ?? release,
        state: 'available',
        downloadFailed: !token.cancelled
      })
    } finally {
      activeDownload = null
      token.dispose()
    }
  })

  ipcMain.handle('update:cancel-download', (_event, version: string) => {
    if (currentStatus?.state !== 'downloading' || currentStatus.release.version !== version || !activeDownload) {
      return
    }
    broadcast({ ...currentStatus, cancelling: true })
    // The updater rejects the promise without necessarily closing the HTTP response.
    activeDownload.token.cancel()
    for (const request of activeDownload.requests) request.abort()
  })

  ipcMain.handle('update:install', (_event, version: string) => {
    if (isPortable || currentStatus?.state !== 'downloaded' || currentStatus.release.version !== version) {
      return
    }
    const { release } = currentStatus
    broadcast({ release, state: 'installing' })
    try {
      // The assisted NSIS installer relaunches CyberFeeds when applied silently.
      autoUpdater.quitAndInstall(true, true)
    } catch (error) {
      console.error('[Updater] Installation failed:', error)
      broadcast({ release, state: 'downloaded', installFailed: true })
    }
  })

  // CyberFeeds offers an automatic check at startup.
  setTimeout(() => {
    if (autoUpdateEnabled) void checkForUpdates()
  }, 8000)
}

export function setAutoUpdate(enabled: boolean): void {
  autoUpdateEnabled = enabled
}
