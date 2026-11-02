import { app, dialog } from 'electron'
import fs from 'fs'
import path from 'path'
import { getSettings } from './db'

// Self-recovery helpers. A power cut can corrupt Chromium's GPU shader caches,
// which leaves the main process alive but the renderer unable to paint (black
// window). These helpers clear the regenerable caches after an unclean exit or
// an explicit recovery relaunch, and bound the automatic relaunch attempts so
// a persistent failure can never turn into an infinite restart loop.

const GPU_CACHE_DIRS = ['GPUCache', 'DawnGraphiteCache', 'DawnWebGPUCache', 'Code Cache']
const CLEAN_EXIT_MARKER = 'last-clean-exit'
const RECOVERY_ATTEMPTS_FILE = 'recovery-attempts.json'
const ATTEMPTS_WINDOW_MS = 10 * 60 * 1000
const MAX_ATTEMPTS = 3

interface RecoveryAttempts {
  count: number
  firstAt: number
}

function userDataFile(name: string): string {
  return path.join(app.getPath('userData'), name)
}

export function clearGpuCaches(): void {
  const base = app.getPath('userData')
  for (const dir of GPU_CACHE_DIRS) {
    try {
      const full = path.join(base, dir)
      if (fs.existsSync(full)) {
        fs.rmSync(full, { recursive: true, force: true })
        console.log(`[Recovery] Cleared cache: ${dir}`)
      }
    } catch (err) {
      console.warn(`[Recovery] Failed to clear cache ${dir}:`, err)
    }
  }
}

export function markCleanExit(): void {
  try {
    fs.writeFileSync(userDataFile(CLEAN_EXIT_MARKER), String(Date.now()))
  } catch {
    /* best effort */
  }
}

export function wasLastExitClean(): boolean {
  try {
    return fs.existsSync(userDataFile(CLEAN_EXIT_MARKER))
  } catch {
    return false
  }
}

// Runs at the top of app.whenReady, before any window exists: deleting the
// cache folders while Chromium is not using them is what makes this safe.
export function startupRecovery(): void {
  if (process.argv.includes('--recover-gpu')) {
    console.log('[Recovery] Recovery relaunch requested, clearing GPU caches')
    clearGpuCaches()
    return
  }
  if (!wasLastExitClean()) {
    // No marker means the previous run never reached before-quit: hard crash,
    // force kill or power loss. First run lands here too, where clearing is a
    // harmless no-op because the caches do not exist yet.
    console.log('[Recovery] No clean-exit marker, clearing GPU caches as a precaution')
    clearGpuCaches()
  }
}

function readAttempts(): RecoveryAttempts {
  try {
    const raw = JSON.parse(
      fs.readFileSync(userDataFile(RECOVERY_ATTEMPTS_FILE), 'utf-8')
    ) as RecoveryAttempts
    if (typeof raw?.count === 'number' && typeof raw?.firstAt === 'number') return raw
  } catch {
    /* missing or corrupt file counts as no attempts */
  }
  return { count: 0, firstAt: 0 }
}

function writeAttempts(attempts: RecoveryAttempts): void {
  try {
    fs.writeFileSync(userDataFile(RECOVERY_ATTEMPTS_FILE), JSON.stringify(attempts))
  } catch {
    /* best effort */
  }
}

export function canAutoRecover(): boolean {
  const attempts = readAttempts()
  return Date.now() - attempts.firstAt > ATTEMPTS_WINDOW_MS || attempts.count < MAX_ATTEMPTS
}

export function clearRecoveryAttempts(): void {
  try {
    fs.rmSync(userDataFile(RECOVERY_ATTEMPTS_FILE), { force: true })
  } catch {
    /* best effort */
  }
}

function registerRecoveryAttempt(): void {
  const attempts = readAttempts()
  const now = Date.now()
  const expired = now - attempts.firstAt > ATTEMPTS_WINDOW_MS
  const next: RecoveryAttempts = expired
    ? { count: 1, firstAt: now }
    : { count: attempts.count + 1, firstAt: attempts.firstAt }
  writeAttempts(next)
  console.warn(`[Recovery] Registered recovery attempt ${next.count}/${MAX_ATTEMPTS}`)
}

// Last-resort recovery: quit and relaunch with --recover-gpu so startupRecovery
// clears the caches before any window exists. Original args are preserved so a
// --hidden autostart relaunch stays hidden. app.exit skips before-quit on
// purpose: the next start must see the run as unclean.
function showRecoveryDialog(): void {
  const lang = getSettings().language || 'en'
  const title = lang === 'es' ? 'CyberFeeds no pudo iniciarse' : 'CyberFeeds failed to start'
  const message =
    lang === 'es'
      ? 'La ventana no responde tras varios intentos automáticos de recuperación.\n\nCierra CyberFeeds y vuelve a abrirlo. Si el problema continúa, reinstala la aplicación.'
      : 'The window did not respond after several automatic recovery attempts.\n\nClose CyberFeeds and reopen it. If the problem continues, reinstall the application.'
  dialog.showErrorBox(title, message)
}

let recoveryDialogShown = false

export function relaunchWithRecovery(): void {
  if (!canAutoRecover()) {
    if (!recoveryDialogShown) {
      recoveryDialogShown = true
      console.error('[Recovery] Automatic recovery budget exhausted')
      showRecoveryDialog()
    }
    return
  }
  registerRecoveryAttempt()
  console.warn('[Recovery] Relaunching with GPU cache recovery')
  app.relaunch({ args: [...process.argv.slice(1), '--recover-gpu'] })
  app.exit(0)
}
