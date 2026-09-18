import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import * as db from './db'
import type { AutoBackupFileInfo, AutoBackupFrequency } from '../shared/types'

let checkIntervalTimer: ReturnType<typeof setInterval> | null = null
let isBackingUp = false

export function getDefaultBackupDirectory(): string {
  return path.join(app.getPath('userData'), 'backups')
}

export function getResolvedBackupDirectory(): string {
  const settings = db.getSettings()
  const custom = settings.autoBackup?.customPath?.trim()
  if (custom) {
    try {
      if (!fs.existsSync(custom)) {
        fs.mkdirSync(custom, { recursive: true })
      }
      return custom
    } catch (err) {
      console.error('[AutoBackup] Error using custom backup path, falling back to default:', err)
    }
  }

  const defaultDir = getDefaultBackupDirectory()
  try {
    if (!fs.existsSync(defaultDir)) {
      fs.mkdirSync(defaultDir, { recursive: true })
    }
  } catch (err) {
    console.error('[AutoBackup] Error creating default backup directory:', err)
  }
  return defaultDir
}

function getFrequencyMs(frequency: AutoBackupFrequency): number {
  switch (frequency) {
    case 'onStartup':
      // Grace window: avoid duplicate backups if restarted within 5 minutes
      return 5 * 60 * 1000
    case 'daily':
      return 24 * 60 * 60 * 1000
    case 'weekly':
      return 7 * 24 * 60 * 60 * 1000
    case 'monthly':
      return 30 * 24 * 60 * 60 * 1000
    default:
      return 24 * 60 * 60 * 1000
  }
}

function pruneOldBackups(dir: string, maxBackups: number): void {
  try {
    if (!fs.existsSync(dir)) return
    const max = Math.max(1, maxBackups || 3)
    const files = fs.readdirSync(dir)
    const backupFiles = files
      .filter((file) => /^cyberfeeds_backup_.*\.json$/i.test(file) && !file.endsWith('.tmp'))
      .map((file) => {
        const fullPath = path.join(dir, file)
        try {
          const stats = fs.statSync(fullPath)
          return { file, fullPath, mtimeMs: stats.mtimeMs }
        } catch {
          return null
        }
      })
      .filter((item): item is { file: string; fullPath: string; mtimeMs: number } => item !== null)
      .sort((a, b) => b.mtimeMs - a.mtimeMs)

    if (backupFiles.length > max) {
      const toDelete = backupFiles.slice(max)
      for (const item of toDelete) {
        try {
          fs.unlinkSync(item.fullPath)
          console.log(`[AutoBackup] Pruned old backup file: ${item.file}`)
        } catch (err) {
          console.error(`[AutoBackup] Failed to prune file ${item.file}:`, err)
        }
      }
    }
  } catch (err) {
    console.error('[AutoBackup] Error during backup pruning:', err)
  }
}

export async function performAutoBackup(trigger: string = 'manual'): Promise<{ ok: boolean; filePath?: string; error?: string }> {
  if (isBackingUp) {
    return { ok: false, error: 'Backup in progress' }
  }

  isBackingUp = true
  try {
    const settings = db.getSettings()
    const targetDir = getResolvedBackupDirectory()
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true })
    }

    const now = new Date()
    const pad = (n: number): string => String(n).padStart(2, '0')
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`
    const filename = `cyberfeeds_backup_${dateStr}.json`
    const tmpPath = path.join(targetDir, `${filename}.tmp`)
    const finalPath = path.join(targetDir, filename)

    const data = db.getBackupData()
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8')
    fs.renameSync(tmpPath, finalPath)

    // Update last backup timestamp
    const updatedSettings = {
      ...settings,
      autoBackup: {
        ...settings.autoBackup,
        lastBackupTime: now.getTime()
      }
    }
    db.saveSettings(updatedSettings)

    // Prune excess backups according to maxBackups
    pruneOldBackups(targetDir, settings.autoBackup?.maxBackups ?? 3)

    console.log(`[AutoBackup] Backup completed successfully (${trigger}): ${finalPath}`)
    return { ok: true, filePath: finalPath }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error('[AutoBackup] Error performing backup:', errorMsg)
    return { ok: false, error: errorMsg }
  } finally {
    isBackingUp = false
  }
}

export async function checkAndRunScheduledBackup(isStartup = false): Promise<void> {
  const settings = db.getSettings()
  if (!settings.autoBackup?.enabled) return

  const freq = settings.autoBackup.frequency || 'daily'
  const lastTime = settings.autoBackup.lastBackupTime ?? 0
  const intervalMs = getFrequencyMs(freq)
  const now = Date.now()

  if (isStartup) {
    if (freq === 'onStartup') {
      if (now - lastTime >= 5 * 60 * 1000) {
        await performAutoBackup('startup')
      }
      return
    }
  }

  if (now - lastTime >= intervalMs) {
    await performAutoBackup(isStartup ? 'startup-interval-catchup' : 'scheduled')
  }
}

export async function listAutoBackups(): Promise<AutoBackupFileInfo[]> {
  try {
    const targetDir = getResolvedBackupDirectory()
    if (!fs.existsSync(targetDir)) return []

    const files = fs.readdirSync(targetDir)
    const backupList: AutoBackupFileInfo[] = []

    for (const file of files) {
      if (!/^cyberfeeds_backup_.*\.json$/i.test(file) || file.endsWith('.tmp')) {
        continue
      }
      const fullPath = path.join(targetDir, file)
      try {
        const stats = fs.statSync(fullPath)
        backupList.push({
          filename: file,
          filePath: fullPath,
          timestamp: Math.round(stats.mtimeMs),
          sizeBytes: stats.size
        })
      } catch {
        /* skip unreadable */
      }
    }

    // Sort newest first
    backupList.sort((a, b) => b.timestamp - a.timestamp)
    return backupList
  } catch (err) {
    console.error('[AutoBackup] Failed to list auto backups:', err)
    return []
  }
}

export async function restoreAutoBackup(filePath: string): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!fs.existsSync(filePath)) {
      return { ok: false, error: 'Backup file not found' }
    }
    const content = fs.readFileSync(filePath, 'utf-8')
    const data = JSON.parse(content)
    db.restoreBackupData(data)
    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[AutoBackup] Error restoring backup:', msg)
    return { ok: false, error: msg }
  }
}

export async function deleteAutoBackup(filePath: string): Promise<{ ok: boolean; error?: string }> {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}

export function initAutoBackup(): void {
  rescheduleAutoBackup()
  // Run startup check
  setTimeout(() => {
    void checkAndRunScheduledBackup(true)
  }, 10000)
}

export function rescheduleAutoBackup(): void {
  if (checkIntervalTimer) {
    clearInterval(checkIntervalTimer)
    checkIntervalTimer = null
  }

  // Check hourly
  checkIntervalTimer = setInterval(() => {
    void checkAndRunScheduledBackup(false)
  }, 60 * 60 * 1000)
}
