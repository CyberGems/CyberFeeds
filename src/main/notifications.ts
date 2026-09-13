import { BrowserWindow, screen, ipcMain, shell, app } from 'electron'
import type { Display } from 'electron'
import path from 'path'
import url from 'url'
import fs from 'fs'
import { exec } from 'child_process'
import { is } from '@electron-toolkit/utils'
import * as db from './db'
import { restoreMainWindow } from './index'
import { translations } from '../shared/translations'
import type { NotificationDisplayMode, NotificationHistoryItem, NotificationSettings } from './types'
import { setTrayActivity } from './tray'

let notifierWindow: BrowserWindow | null = null
const displayStack: NotificationHistoryItem[] = []
let hideTimer: ReturnType<typeof setTimeout> | null = null
let settings: NotificationSettings
let lastSoundTime = 0
let isHovering = false

// Pixel height of each notification card (content + gap)
const CARD_BASE_H = 165
const THUMB_H = 105 // 100px img + gap
const CARD_GAP = 6
const CLEAR_BAR_H = 34
const WIN_PAD = 16
const HARD_CAP = 50
const DEFAULT_MAX_HEIGHT_PERCENT = 65
const MIN_MAX_HEIGHT_PERCENT = 35
const MAX_MAX_HEIGHT_PERCENT = 90
const CARD_COMPACT_H = 92
// Extra width reserved for the scrollbar so action buttons aren't cramped/clipped
// when the stack overflows and the scrollbar appears.
const SCROLLBAR_W = 16
/** Floor width so action buttons + date stay on one row (ES labels are longer). */
const MIN_WIDTH_BY_LANG: Record<string, number> = { en: 400, es: 455 }

function contentWidth(s: NotificationSettings): number {
  const lang = db.getSettings().language || 'en'
  const minW = MIN_WIDTH_BY_LANG[lang] ?? 350
  return Math.max(s.maxWidth || 350, minW)
}

function maxHeightPercent(s: NotificationSettings): number {
  const value = Number(s.maxHeight)
  // maxHeight used to default to 120 and was never exposed in the UI. Treat
  // that legacy value as unset instead of accidentally making the popup 120%.
  if (!Number.isFinite(value) || value < MIN_MAX_HEIGHT_PERCENT || value > MAX_MAX_HEIGHT_PERCENT) {
    return DEFAULT_MAX_HEIGHT_PERCENT
  }
  return Math.round(value)
}

export function initNotifier(s: NotificationSettings): void {
  settings = s
  try {
    if (settings.displayId !== -1 && settings.displayBounds) {
      const displays = screen.getAllDisplays()
      const saved = settings.displayBounds
      const matched = displays.find(d =>
        d.bounds.x === saved.x &&
        d.bounds.y === saved.y &&
        d.bounds.width === saved.width &&
        d.bounds.height === saved.height
      )
      if (matched && matched.id !== settings.displayId) {
        console.log(`[Notifier] Startup auto-align: updating displayId from ${settings.displayId} to ${matched.id}`)
        settings.displayId = matched.id
        db.saveSettings({
          ...db.getSettings(),
          notifications: settings
        })
      }
    }
  } catch (err) {
    console.error('[Notifier] Failed to auto-align display ID on startup:', err)
  }
  // Preload the hidden notifier so the first preview/toast isn't waiting on Chromium.
  ensureWindow()
  resolveDefaultSound()
}
export function updateNotifierSettings(s: NotificationSettings): void {
  const prevFilters = new Set(settings?.feedFilters ?? [])
  settings = s
  const newlyMuted = (s.feedFilters ?? []).filter((id) => id && !prevFilters.has(id))
  for (const id of newlyMuted) {
    removeFeedFromQueues(id)
  }
  if (notifierWindow && !notifierWindow.isDestroyed() && notifierWindow.isVisible()) {
    applyPositionToWindow(notifierWindow, displayStack.length, settings)
  }
}

function resolveDisplay(s: NotificationSettings): Display {
  const displays = screen.getAllDisplays()
  const primaryDisplay = screen.getPrimaryDisplay()

  let display: Display | null = null

  // 0. Active monitor mode: displayId === -1 places notifications on monitor where mouse cursor is
  if (s.displayId === -1) {
    try {
      const cursorPt = screen.getCursorScreenPoint()
      display = screen.getDisplayNearestPoint(cursorPt)
    } catch (err) {
      console.warn('[Notifier] Failed to get active display from cursor point:', err)
    }
  }

  // 1. Try to match by saved bounds first (most stable across reboots/hotplugs)
  if (!display && s.displayBounds) {
    const saved = s.displayBounds
    display = displays.find(d =>
      d.bounds.x === saved.x &&
      d.bounds.y === saved.y &&
      d.bounds.width === saved.width &&
      d.bounds.height === saved.height
    ) ?? null
    if (display) {
      // Auto-align setting if ID changed mid-run
      if (display.id !== s.displayId) {
        console.log(`[Notifier] Display ID changed mid-run from ${s.displayId} to ${display.id}, updating settings`)
        s.displayId = display.id
        db.saveSettings({
          ...db.getSettings(),
          notifications: s
        })
      }
    }
  }

  // 2. Fallback to ID
  if (!display) {
    display = displays.find(d => d.id === s.displayId) ?? null
  }

  // 3. Fallback to primary display
  if (!display) {
    console.warn(`[Notifier] Display ${s.displayId} not found, falling back to primary`)
    display = primaryDisplay
  }

  return display
}

function maxNotifierHeight(s: NotificationSettings): number {
  const { workArea: wa } = resolveDisplay(s)
  const margin = Math.max(4, Math.round(Number(s.marginY) || 16))
  const availableHeight = Math.max(1, wa.height - margin * 2)
  return Math.max(1, Math.min(availableHeight, Math.round((wa.height * maxHeightPercent(s)) / 100)))
}

function resolveDisplayMode(s: NotificationSettings, cardCount: number): NotificationDisplayMode {
  if (s.displayMode === 'compact' || s.displayMode === 'detailed') return s.displayMode

  const maxStack = Math.max(1, Number(s.maxStack) || 2)
  const visibleCards = Math.min(Math.max(1, cardCount), maxStack)
  const visible = displayStack.slice(0, visibleCards)
  const thumbCount = s.showThumbnails ? visible.filter((n) => n.thumbnail).length : 0
  const gaps = Math.max(0, visibleCards - 1) * CARD_GAP
  const peekH = cardCount > maxStack ? 44 : 0
  const detailedHeight =
    visibleCards * CARD_BASE_H + thumbCount * THUMB_H + gaps + WIN_PAD + CLEAR_BAR_H + peekH

  return detailedHeight > maxNotifierHeight(s) ? 'compact' : 'detailed'
}

function estimatedWindowHeight(
  cardCount: number,
  s: NotificationSettings,
  mode: NotificationDisplayMode
): number {
  const maxStack = Math.max(1, Number(s.maxStack) || 2)
  const visibleCards = Math.min(Math.max(1, cardCount), maxStack)
  const gaps = Math.max(0, visibleCards - 1) * CARD_GAP
  const visible = displayStack.slice(0, visibleCards)
  const thumbCount = mode === 'detailed' && s.showThumbnails
    ? visible.filter((n) => n.thumbnail).length
    : 0
  const cardHeight = mode === 'compact' ? CARD_COMPACT_H : CARD_BASE_H
  const peekH = cardCount > maxStack ? 44 : 0

  return visibleCards * cardHeight + thumbCount * THUMB_H + gaps + WIN_PAD + CLEAR_BAR_H + peekH
}

/**
 * Calculate (x, y) for the notifier window given EXPLICIT width+height.
 * Never reads win.getBounds() — avoids Windows timing lag after setSize().
 */
function calcPosition(
  winW: number,
  winH: number,
  s: NotificationSettings
): { x: number; y: number } {
  const { workArea: wa } = resolveDisplay(s)

  const mx = Math.round(s.marginX)
  const isBottom = (s.position || '').startsWith('bottom')
  // Bottom toasts sit above a leftover window pad; keep them a bit closer to
  // the work-area edge (left/right taskbars don't eat vertical space).
  const my = Math.round(isBottom ? Math.max(4, (s.marginY || 16) - 8) : s.marginY)

  const map: Record<string, { x: number; y: number }> = {
    'top-left':      { x: wa.x + mx,                              y: wa.y + my },
    'top-center':    { x: wa.x + Math.round((wa.width - winW) / 2), y: wa.y + my },
    'top-right':     { x: wa.x + wa.width  - winW - mx,           y: wa.y + my },
    'bottom-left':   { x: wa.x + mx,                              y: wa.y + wa.height - winH - my },
    'bottom-center': { x: wa.x + Math.round((wa.width - winW) / 2), y: wa.y + wa.height - winH - my },
    'bottom-right':  { x: wa.x + wa.width  - winW - mx,           y: wa.y + wa.height - winH - my }
  }

  const p = map[s.position] ?? map['bottom-right']
  const minX = wa.x + mx
  const maxX = Math.max(minX, wa.x + wa.width - winW - mx)
  const minY = wa.y + my
  const maxY = Math.max(minY, wa.y + wa.height - winH - my)
  return {
    x: Math.min(maxX, Math.max(minX, Math.round(p.x))),
    y: Math.min(maxY, Math.max(minY, Math.round(p.y)))
  }
}

/** Resize window to fit N cards without exceeding the selected display. */
function applyPositionToWindow(
  win: BrowserWindow,
  cardCount: number,
  s: NotificationSettings
): void {
  // Always reserve scrollbar gutter width so cards aren't clipped on the right
  // when there is no overflow (Windows frameless windows + action-button row).
  const winW = contentWidth(s) + SCROLLBAR_W
  const mode = resolveDisplayMode(s, cardCount)
  const winH = Math.min(estimatedWindowHeight(cardCount, s, mode), maxNotifierHeight(s))

  const { x, y } = calcPosition(winW, winH, s)
  const bounds = { x, y, width: winW, height: winH }
  // Atomic update of position and size to avoid Windows-specific lag/flicker
  win.setBounds(bounds, false)
  if (process.platform === 'win32') {
    // Transparent frameless windows often ignore the first setBounds Y on Windows
    // (they keep the default centered origin). Stamp position again.
    win.setPosition(x, y, false)
  }
}

function reassertNotifierPosition(win: BrowserWindow, cardCount: number, s: NotificationSettings): void {
  if (win.isDestroyed()) return
  applyPositionToWindow(win, cardCount, s)
  if (process.platform !== 'win32') return
  setImmediate(() => {
    if (!win.isDestroyed()) applyPositionToWindow(win, cardCount, s)
  })
}

let notifierReady: Promise<void> | null = null

function createNotifierWindow(s: NotificationSettings): BrowserWindow {
  const initW = contentWidth(s) + SCROLLBAR_W
  const initH = CARD_BASE_H + CLEAR_BAR_H + WIN_PAD
  const { x, y } = calcPosition(initW, initH, s)
  const win = new BrowserWindow({
    x,
    y,
    width: initW,
    height: initH,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    paintWhenInitiallyHidden: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
      backgroundThrottling: false
    }
  })

  win.setIgnoreMouseEvents(false)
  win.webContents.setBackgroundThrottling(false)

  notifierReady = new Promise<void>((resolve) => {
    win.webContents.once('did-finish-load', () => resolve())
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/notifier/index.html`)
  } else {
    win.loadFile(path.join(__dirname, '../renderer/notifier/index.html'))
  }

  win.on('closed', () => {
    notifierWindow = null
    notifierReady = null
  })
  return win
}

function waitUntilReady(win: BrowserWindow): Promise<void> {
  if (win.isDestroyed() || !win.webContents.isLoading()) return Promise.resolve()
  return Promise.race([
    notifierReady ?? new Promise<void>((resolve) => {
      win.webContents.once('did-finish-load', () => resolve())
    }),
    new Promise<void>((resolve) => setTimeout(resolve, 1500))
  ])
}

function ensureWindow(): BrowserWindow {
  if (!notifierWindow || notifierWindow.isDestroyed()) {
    notifierWindow = createNotifierWindow(settings)
  }
  return notifierWindow
}

/** Push current stack to the notifier window, size & position it, show if hidden. */
let isPushing = false
async function pushToWindow(s: NotificationSettings = settings): Promise<boolean> {
  if (displayStack.length === 0) return false
  if (isPushing) return false // Avoid re-entry if multiple notifications arrive fast
  
  isPushing = true
  try {
    const win = ensureWindow()
    await waitUntilReady(win)

    if (win.isDestroyed()) return false

    console.log(`[Notifier] Pushing stack (size: ${displayStack.length}) to window`)

    // 1. Resize + reposition with EXPLICIT sizes
    applyPositionToWindow(win, displayStack.length, s)

    // 2. Send stack to renderer
    win.webContents.send(
      'notifier:stack',
      displayStack,
      s,
      db.getSettings().language || 'en',
      db.getUnseenNotificationCount(),
      resolveDisplayMode(s, displayStack.length)
    )

    // 3. Re-apply alwaysOnTop to ensure window stays in foreground
    //    (Windows can demote z-order after repeated hide/show cycles)
    win.setAlwaysOnTop(true, 'screen-saver')

    // 4. Show — then stamp position again. showInactive() can recenter
    //    transparent windows on Windows.
    if (!win.isVisible()) {
      console.log('[Notifier] Showing window (showInactive)')
      win.showInactive()
    }
    reassertNotifierPosition(win, displayStack.length, s)

    // Wait until the renderer has had two paint frames after receiving the
    // stack, keeping the notification sound synchronized with the visible card.
    let painted = true
    try {
      await win.webContents.executeJavaScript(
        'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))'
      )
    } catch (err) {
      painted = false
      console.error('[Notifier] Failed waiting for notification paint:', err)
    }

    // 5. Auto-hide
    if (hideTimer) clearTimeout(hideTimer)
    if (!isHovering) {
      hideTimer = setTimeout(() => {
        if (notifierWindow && !notifierWindow.isDestroyed()) {
          console.log('[Notifier] Auto-hiding window')
          notifierWindow.hide()
          displayStack.length = 0
        }
      }, s.duration + 500)
    }
    return painted
  } finally {
    isPushing = false
  }
}

let cachedDefaultSound: string | null | undefined

function resolveDefaultSound(): string | null {
  if (cachedDefaultSound !== undefined) return cachedDefaultSound
  const candidates = [
    path.join(process.resourcesPath, 'app.asar.unpacked', 'resources', 'CyberFeeds.mp3'),
    path.join(app.getAppPath(), 'resources', 'CyberFeeds.mp3'),
    'C:\\CyberGems\\CyberFeeds\\CyberFeeds.mp3'
  ]
  cachedDefaultSound = candidates.find((p) => fs.existsSync(p)) ?? null
  return cachedDefaultSound
}

function playNotificationSound(s: NotificationSettings): void {
  if (s.soundEnabled === false) {
    console.log('[Notifier] Sound is disabled')
    return
  }

  const playPath = s.soundFile || resolveDefaultSound()

  if (playPath) {
    console.log(`[Notifier] Playing sound: ${playPath}`)
    try {
      const win = ensureWindow()
      const encoded = url.pathToFileURL(playPath).toString()
      win.webContents.executeJavaScript(
        `(function(){ 
          var a = new Audio('${encoded}'); 
          a.volume = 0.7; 
          a.play().catch(function(e){ console.error('Sound play failed:', e); }); 
        })()`
      ).catch(err => console.error('[Notifier] JS execution failed:', err))
    } catch (err) {
      console.error('[Notifier] Error playing sound:', err)
    }
  } else {
    console.log('[Notifier] Playing system beep')
    shell.beep()
  }
}

const scriptPath = path.join(app.getPath('userData'), 'detect-fullscreen.ps1')
const queuedNotifications: NotificationHistoryItem[] = []
let queueCheckInterval: ReturnType<typeof setInterval> | null = null

function ensureScriptFile(): void {
  const scriptContent = `Add-Type -AssemblyName System.Windows.Forms
$code = @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    [DllImport("user32.dll")]
    public static extern IntPtr GetShellWindow();
    [DllImport("user32.dll")]
    public static extern int GetWindowLong(IntPtr hWnd, int nIndex);
    public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
}
"@
Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue
$fg = [Win32]::GetForegroundWindow()
$shell = [Win32]::GetShellWindow()
if ($fg -ne [IntPtr]::Zero -and $fg -ne $shell) {
    $rect = New-Object Win32+RECT
    if ([Win32]::GetWindowRect($fg, [ref]$rect)) {
        $width = $rect.Right - $rect.Left
        $height = $rect.Bottom - $rect.Top
        $screen = [System.Windows.Forms.Screen]::FromHandle($fg)
        if ($width -ge $screen.Bounds.Width -and $height -ge $screen.Bounds.Height) {
            $style = [Win32]::GetWindowLong($fg, -16)
            if (($style -band 0x00C00000) -eq 0) {
                Write-Output "true"
                exit
            }
        }
    }
}
Write-Output "false"
`
  try {
    fs.writeFileSync(scriptPath, scriptContent, 'utf-8')
  } catch (err) {
    console.error('[Notifier] Failed to write fullscreen detection script:', err)
  }
}

function isAnyAppFullscreen(): Promise<boolean> {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve(false)
      return
    }
    ensureScriptFile()
    exec(`powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`, (err, stdout) => {
      if (err) {
        console.error('[Notifier] Fullscreen check error:', err)
        resolve(false)
        return
      }
      resolve(stdout.trim().toLowerCase() === 'true')
    })
  })
}

const incomingBatchQueue: NotificationHistoryItem[] = []
let batchTimer: ReturnType<typeof setTimeout> | null = null
let batchStartTime = 0
let currentBatchId = 0
const BATCH_DEBOUNCE_MS = 1200
const BATCH_MAX_WAIT_MS = 3000

let isBatchBlockedByPolling = false

export function setPollingBatchHold(hold: boolean): void {
  isBatchBlockedByPolling = hold
  if (!hold) {
    if (incomingBatchQueue.length > 0) {
      if (batchTimer) {
        clearTimeout(batchTimer)
        batchTimer = null
      }
      void flushBatch()
    } else {
      setTrayActivity('batch', false)
    }
  }
}

export function cancelPendingBatch(): void {
  currentBatchId++
  incomingBatchQueue.length = 0
  if (batchTimer) {
    clearTimeout(batchTimer)
    batchTimer = null
  }
  batchStartTime = 0
  setTrayActivity('batch', false)
}

function persistNotifierSettings(next: NotificationSettings): void {
  settings = next
  db.saveSettings({ ...db.getSettings(), notifications: settings })
  const mainWin = BrowserWindow.getAllWindows().find((w) => w !== notifierWindow && !w.isDestroyed())
  if (mainWin) {
    mainWin.webContents.send('settings:changed', db.getSettings())
  }
}

function removeFeedFromQueues(feedId: string): void {
  if (!feedId) return
  const drop = (arr: NotificationHistoryItem[]): void => {
    for (let i = arr.length - 1; i >= 0; i--) {
      if (arr[i].feedId === feedId) arr.splice(i, 1)
    }
  }
  drop(displayStack)
  drop(incomingBatchQueue)
  drop(queuedNotifications)

  if (incomingBatchQueue.length === 0) {
    if (batchTimer) {
      clearTimeout(batchTimer)
      batchTimer = null
    }
    batchStartTime = 0
    if (displayStack.length === 0) setTrayActivity('batch', false)
  }

  if (displayStack.length === 0) {
    if (hideTimer) clearTimeout(hideTimer)
    notifierWindow?.hide()
  } else {
    void pushToWindow()
  }
}

/** Persist mute and drop any pending/visible cards for this feed. */
export function muteFeed(feedId: string): void {
  if (!feedId) return
  if (!(settings.feedFilters ?? []).includes(feedId)) {
    persistNotifierSettings({ ...settings, feedFilters: [...(settings.feedFilters ?? []), feedId] })
  }
  removeFeedFromQueues(feedId)
}

/** Drop a deleted feed id from the mute list. */
export function pruneFeedFilter(feedId: string): void {
  if (!feedId || !(settings.feedFilters ?? []).includes(feedId)) return
  persistNotifierSettings({
    ...settings,
    feedFilters: (settings.feedFilters ?? []).filter((id) => id !== feedId)
  })
}

async function flushBatch(): Promise<void> {
  if (incomingBatchQueue.length === 0) {
    setTrayActivity('batch', false)
    return
  }
  const batch = [...incomingBatchQueue]
  incomingBatchQueue.length = 0
  batchStartTime = 0
  const thisBatchId = ++currentBatchId

  console.log(`[Notifier] Preparing batch of ${batch.length} notification(s)...`)

  try {
    // Preload all thumbnails in parallel for the whole batch
    const processed = await Promise.all(
      batch.map(async (item) => {
        const displayItem: NotificationHistoryItem = { ...item }
        if (settings.showThumbnails && displayItem.thumbnail) {
          const dataUrl = await preloadImageDataUrl(displayItem.thumbnail)
          if (dataUrl) displayItem.thumbnail = dataUrl
        }
        return displayItem
      })
    )

    // If the batch was cancelled while preloading (e.g. user dismissed all / snoozed)
    if (thisBatchId !== currentBatchId) {
      console.log(`[Notifier] Batch ${thisBatchId} was cancelled during preparation, skipping push`)
      return
    }

    const allowed = processed.filter((item) => !(settings.feedFilters ?? []).includes(item.feedId || ''))
    if (allowed.length === 0) return

    // Push all processed items to displayStack
    displayStack.push(...allowed)
    if (displayStack.length > HARD_CAP) {
      displayStack.splice(0, displayStack.length - HARD_CAP)
    }

    const displayed = await pushToWindow()
    if (displayed && thisBatchId === currentBatchId && Date.now() - lastSoundTime > 60_000) {
      playNotificationSound(settings)
      lastSoundTime = Date.now()
    }
  } finally {
    setTrayActivity('batch', false)
  }
}

function queueForBatch(item: NotificationHistoryItem): void {
  incomingBatchQueue.push(item)
  setTrayActivity('batch', true)

  // When a full poll cycle is in progress, hold the batch until the cycle finishes
  if (isBatchBlockedByPolling) {
    return
  }

  if (!batchStartTime) {
    batchStartTime = Date.now()
  }
  const elapsed = Date.now() - batchStartTime
  const delay = Math.min(BATCH_DEBOUNCE_MS, Math.max(200, BATCH_MAX_WAIT_MS - elapsed))

  if (batchTimer) clearTimeout(batchTimer)
  batchTimer = setTimeout(() => {
    batchTimer = null
    void flushBatch()
  }, delay)
}

function startQueueChecker(): void {
  if (queueCheckInterval) return

  queueCheckInterval = setInterval(async () => {
    if (queuedNotifications.length === 0) {
      stopQueueChecker()
      return
    }

    const isFullscreen = await isAnyAppFullscreen()
    if (!isFullscreen) {
      console.log(`[Notifier] Screen no longer in fullscreen. Flushing ${queuedNotifications.length} queued notifications.`)
      const itemsToPresent = [...queuedNotifications]
      queuedNotifications.length = 0
      stopQueueChecker()

      for (const item of itemsToPresent) {
        if (!(settings.feedFilters ?? []).includes(item.feedId || '')) {
          queueForBatch(item)
        }
      }
    }
  }, 10_000)
}

function stopQueueChecker(): void {
  if (queueCheckInterval) {
    clearInterval(queueCheckInterval)
    queueCheckInterval = null
  }
}

export async function showNotification(item: NotificationHistoryItem): Promise<void> {
  console.log(`[Notifier] showNotification triggered for: ${item.title}`)
  if (!settings.enabled) {
    console.warn('[Notifier] Notification suppressed: notifications are disabled')
    return
  }
  if (settings.snoozedUntil && Date.now() < settings.snoozedUntil) {
    console.warn('[Notifier] Notification suppressed: snoozed until', new Date(settings.snoozedUntil).toISOString())
    return
  }
  if ((settings.feedFilters ?? []).includes(item.feedId || '')) {
    console.warn(`[Notifier] Notification suppressed: feed ${item.feedId} is filtered`)
    return
  }

  const combined = `${item.title} ${item.body}`.toLowerCase()
  if (settings.keywordFilters.some(kw => combined.includes(kw.toLowerCase()))) {
    console.warn('[Notifier] Notification suppressed: matched keyword filter')
    return
  }

  // History and the main-window badge update immediately. The popup and sound
  // are deferred until the batch has passed fullscreen filtering and rendering.
  db.addNotificationHistory(item)

  const mainWin = BrowserWindow.getAllWindows().find(w => w !== notifierWindow && !w.isDestroyed())
  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.webContents.send('notifications:new', item)
  }

  if (settings.disableOnFullscreen) {
    const isFullscreen = await isAnyAppFullscreen()
    if (isFullscreen) {
      console.log(`[Notifier] Suppressing popup: full screen detected. Queuing notification: ${item.title}`)
      queuedNotifications.push(item)
      startQueueChecker()
      return
    }
  }

  queueForBatch(item)
}

/**
 * Fetch a remote image and return it as a base64 data URL so the renderer can
 * paint it with no network round-trip. Returns null on any failure/timeout or
 * if the source isn't a remote http(s) image.
 */
async function preloadImageDataUrl(src: string, timeoutMs = 4000): Promise<string | null> {
  if (!/^https?:\/\//i.test(src)) return null // already data:/relative — nothing to preload
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(src, { signal: controller.signal })
    if (!res.ok) return null
    const type = res.headers.get('content-type') || 'image/jpeg'
    if (!type.startsWith('image/')) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length === 0 || buf.length > 8 * 1024 * 1024) return null // skip empty/oversized
    return `data:${type};base64,${buf.toString('base64')}`
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function showSettingsPreview(
  effectiveSettings: NotificationSettings,
  playSound: boolean
): Promise<void> {
  const win = ensureWindow()
  await waitUntilReady(win)
  if (win.isDestroyed()) return

  const lang = (db.getSettings().language || 'en') as 'en' | 'es'
  const previewT = translations[lang]?.settings?.notifications
  const previewItem: NotificationHistoryItem = {
    id: 'preview',
    title: previewT?.previewTitle || 'CyberFeeds — Notification Preview',
    body: previewT?.previewBody || 'Your notifications will appear like this.',
    link: '',
    feedName: 'CyberFeeds',
    createdAt: Date.now()
  }

  displayStack.length = 0
  displayStack.push(previewItem)

  applyPositionToWindow(win, 1, effectiveSettings)
  win.webContents.send(
    'notifier:stack',
    displayStack,
    effectiveSettings,
    lang,
    db.getUnseenNotificationCount(),
    resolveDisplayMode(effectiveSettings, displayStack.length)
  )
  win.setAlwaysOnTop(true, 'screen-saver')
  if (!win.isVisible()) win.showInactive()
  reassertNotifierPosition(win, 1, effectiveSettings)

  if (hideTimer) clearTimeout(hideTimer)
  if (!isHovering) {
    hideTimer = setTimeout(() => {
      if (notifierWindow && !notifierWindow.isDestroyed()) {
        notifierWindow.hide()
        displayStack.length = 0
      }
    }, effectiveSettings.duration + 500)
  }

  if (playSound) playNotificationSound(effectiveSettings)
}

export function registerNotifierIpc(): void {
  ipcMain.on('notifier:muteFeed', (_, feedId: string) => {
    muteFeed(feedId)
  })

  ipcMain.on('notifier:dismiss', (_, id: string) => {
    const idx = displayStack.findIndex(n => n.id === id)
    if (idx !== -1) displayStack.splice(idx, 1)
    if (displayStack.length === 0) {
      cancelPendingBatch()
      notifierWindow?.hide()
    } else {
      pushToWindow()
    }
  })

  ipcMain.on('notifier:clearAll', () => {
    cancelPendingBatch()
    displayStack.length = 0
    notifierWindow?.hide()
  })

  ipcMain.on('notifier:markRead', (_, articleId: string) => {
    if (articleId) db.markArticleRead(articleId, true)
  })

  ipcMain.on('notifier:snooze', (_, minutes: number) => {
    cancelPendingBatch()
    settings = { ...settings, snoozedUntil: Date.now() + minutes * 60_000 }
    db.saveSettings({ ...db.getSettings(), notifications: settings })
    displayStack.length = 0
    notifierWindow?.hide()
  })

  ipcMain.on('notifier:openInApp', (_, feedId: string, articleId: string) => {
    if (settings.closeOnViewInApp) {
      cancelPendingBatch()
      displayStack.length = 0
      notifierWindow?.hide()
    }
    const mainWin = BrowserWindow.getAllWindows().find(w => w !== notifierWindow)
    if (mainWin) {
      restoreMainWindow()
      mainWin.webContents.send('app:openArticle', { feedId, articleId })
    }
  })

  ipcMain.on('notifier:openHistory', () => {
    cancelPendingBatch()
    notifierWindow?.hide()
    const mainWin = BrowserWindow.getAllWindows().find(w => w !== notifierWindow)
    if (mainWin) {
      restoreMainWindow()
      mainWin.webContents.send('app:openHistory')
    }
  })

  ipcMain.on('notifier:openSettings', (_, tab?: string) => {
    cancelPendingBatch()
    notifierWindow?.hide()
    const mainWin = BrowserWindow.getAllWindows().find(w => w !== notifierWindow)
    if (mainWin) {
      restoreMainWindow()
      mainWin.webContents.send('app:openSettings', tab || 'notifications')
    }
  })

  ipcMain.on('notifier:resize', (_, height: number) => {
    if (!notifierWindow || notifierWindow.isDestroyed() || !height || height <= 0) return
    const s = settings
    const winW = contentWidth(s) + SCROLLBAR_W
    const targetH = Math.min(Math.round(height), maxNotifierHeight(s))
    const currentBounds = notifierWindow.getBounds()
    if (currentBounds.height === targetH && currentBounds.width === winW) return
    const { x, y } = calcPosition(winW, targetH, s)
    notifierWindow.setBounds({ x, y, width: winW, height: targetH }, false)
    if (process.platform === 'win32') {
      notifierWindow.setPosition(x, y, false)
    }
  })

  ipcMain.on('notifier:hover', (_, hovering: boolean) => {
    isHovering = hovering
    if (isHovering) {
      if (hideTimer) clearTimeout(hideTimer)
    } else {
      if (displayStack.length > 0) {
        if (hideTimer) clearTimeout(hideTimer)
        hideTimer = setTimeout(() => {
          if (notifierWindow && !notifierWindow.isDestroyed()) {
            notifierWindow.hide()
            displayStack.length = 0
          }
        }, settings.duration + 500)
      }
    }
  })

  /**
   * Preview handler.
   * Accepts OPTIONAL notification settings from the renderer (the UI's local state),
   * so the preview reflects what the user currently has typed — even before Save.
   * Re-entrant: changing position while a preview is up just moves the window.
   */
  ipcMain.handle(
    'notifier:preview',
    async (_, tempNotifSettings?: NotificationSettings, playSound = true) => {
      try {
        const effectiveSettings: NotificationSettings = tempNotifSettings
          ? { ...settings, ...tempNotifSettings }
          : settings
        await showSettingsPreview(effectiveSettings, playSound !== false)
      } catch (err) {
        console.error('[Notifier] Preview error:', err)
      }
      return true
    }
  )
}
