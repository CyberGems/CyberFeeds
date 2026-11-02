import { app } from 'electron'
import fs from 'fs'
import path from 'path'

// Persistent main-process logging. In a packaged Windows build the console
// output goes nowhere, so every console call is mirrored into
// <userData>/logs/main.log. Without this there is no diagnostic trail at all
// for startup failures, renderer crashes or GPU cache corruption.

const MAX_LOG_BYTES = 2 * 1024 * 1024
let logFile: string | null = null
let writeChain: Promise<void> = Promise.resolve()
let initialized = false

type ConsoleFn = (...data: unknown[]) => void

function format(value: unknown): string {
  if (typeof value === 'string') return value
  if (value instanceof Error) return value.stack || value.message
  if (typeof value === 'object' && value !== null) {
    try {
      return JSON.stringify(value) ?? String(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

function append(level: string, args: unknown[]): void {
  if (!logFile) return
  const file = logFile
  const line = `[${new Date().toISOString()}] [${level}] ${args.map(format).join(' ')}\n`
  // Chain writes so ordering is preserved without blocking the main process
  writeChain = writeChain.then(
    () =>
      new Promise<void>((resolve) => {
        fs.appendFile(file, line, () => resolve())
      })
  )
}

function rotateIfNeeded(): void {
  if (!logFile) return
  try {
    if (fs.existsSync(logFile) && fs.statSync(logFile).size > MAX_LOG_BYTES) {
      fs.renameSync(logFile, logFile.replace(/\.log$/, '.old.log'))
    }
  } catch {
    /* rotation is best-effort */
  }
}

export function initLogger(): void {
  if (initialized) return
  initialized = true

  try {
    const logsDir = path.join(app.getPath('userData'), 'logs')
    fs.mkdirSync(logsDir, { recursive: true })
    logFile = path.join(logsDir, 'main.log')
  } catch {
    return // No writable logs dir: keep console-only behavior
  }
  rotateIfNeeded()

  const wrap = (level: 'log' | 'warn' | 'error', original: ConsoleFn): void => {
    console[level] = (...data: unknown[]) => {
      append(level.toUpperCase(), data)
      original(...data)
    }
  }
  wrap('log', console.log)
  wrap('warn', console.warn)
  wrap('error', console.error)

  // Record main-process level faults. unhandledRejection is log-only
  // (Electron already survives it); uncaughtException is logged and then
  // re-thrown so the default crash behavior is preserved unchanged.
  process.on('unhandledRejection', (reason) => {
    console.error('[Logger] Unhandled rejection in main process:', reason)
  })
  process.on('uncaughtException', (err) => {
    console.error('[Logger] Uncaught exception in main process:', err)
    setImmediate(() => {
      throw err
    })
  })
}
