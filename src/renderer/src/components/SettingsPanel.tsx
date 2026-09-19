import { useState, useEffect, useRef, useCallback, type KeyboardEvent } from 'react'
import {
  Settings, Bell, Sliders, Palette, Database, Zap,
  Stethoscope, Keyboard, X, Upload, Download, FolderOpen, RotateCcw, Trash2,
  Languages, RefreshCw, Search, ExternalLink, Power, LayoutDashboard, Type,
  Clock, Volume2, BellOff, Save, Wrench, Monitor, BookOpen, Sparkles,
  Filter, Ban, Star, Plus, ShieldCheck, History, HardDrive
} from 'lucide-react'
import { formatDisplayName } from '@shared/welcome'
import { useUIStore } from '../store/ui.store'
import { useSettingsStore } from '../store/settings.store'
import { useConfirm } from '../hooks/useConfirm'
import { useAlert } from '../hooks/useAlert'
import ConfirmDialog from './ConfirmDialog'
import AlertDialog from './AlertDialog'
import Tooltip from './Tooltip'
import {
  DEFAULT_SETTINGS,
  type AppSettings,
  type KeyboardShortcuts,
  type AutoBackupFileInfo,
  type AutoBackupFrequency
} from '../types'
import { useTranslation } from '../hooks/useTranslation'
import { useFeedsStore } from '../store/feeds.store'
import { FeedFavicon } from './ArticleList'
import logoPng from '../../../../resources/icon.png'

interface DisplayInfo {
  id: number
  label: string
  bounds: { x: number; y: number; width: number; height: number }
  isPrimary?: boolean
}

interface AppVersionInfo {
  app: string
}

type ActiveTab = 'general' | 'appearance' | 'filters' | 'notifications' | 'keyboard' | 'backupMaintenance'
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

/* CyberClock-inspired icon tiles: each settings tab owns an accent color
   used by the nav tile and the section titles inside its cards. */
const TAB_META: Record<ActiveTab, { accent: string; soft: string }> = {
  general: { accent: '#58a6ff', soft: 'rgba(88,166,255,0.14)' },
  appearance: { accent: '#a371f7', soft: 'rgba(163,113,247,0.14)' },
  filters: { accent: '#f778ba', soft: 'rgba(247,120,186,0.14)' },
  notifications: { accent: '#3fb950', soft: 'rgba(63,185,80,0.14)' },
  keyboard: { accent: '#39c5cf', soft: 'rgba(57,197,207,0.14)' },
  backupMaintenance: { accent: '#d29922', soft: 'rgba(210,153,34,0.14)' }
}

function CardTitle({
  icon: Icon,
  accent,
  children,
  danger,
  badge
}: {
  icon: typeof Bell
  accent: string
  children: React.ReactNode
  danger?: boolean
  badge?: React.ReactNode
}): JSX.Element {
  const color = danger ? 'var(--red)' : accent
  return (
    <h3 className="settings-card-title">
      <span
        className="settings-card-ico"
        aria-hidden="true"
        style={{ ['--card-accent' as string]: color }}
      >
        <Icon size={13} strokeWidth={2.2} />
      </span>
      <span>{children}</span>
      {badge}
    </h3>
  )
}

function normalizeKey(key: string, code: string): string {
  if (key.length === 1 && key >= 'a' && key <= 'z') return key.toUpperCase()
  if (key.length === 1 && key >= 'A' && key <= 'Z') return key
  if (key.length === 1 && key >= '0' && key <= '9') return key

  switch (key) {
    case ' ': return 'Space'
    case 'ArrowUp': return 'Up'
    case 'ArrowDown': return 'Down'
    case 'ArrowLeft': return 'Left'
    case 'ArrowRight': return 'Right'
    case 'Escape': return 'Esc'
    case 'Enter': return 'Enter'
    case 'Tab': return 'Tab'
    case 'Backspace': return 'Backspace'
    case 'Delete': return 'Delete'
    case 'Insert': return 'Insert'
    case 'Home': return 'Home'
    case 'End': return 'End'
    case 'PageUp': return 'PageUp'
    case 'PageDown': return 'PageDown'
    case 'PrintScreen': return 'PrintScreen'
    case '`': case '~': return '`'
    case '-': case '_': return '-'
    case '=': case '+': return '='
    case '[': case '{': return '['
    case ']': case '}': return ']'
    case ';': case ':': return ';'
    case "'": case '"': return "'"
    case ',': case '<': return ','
    case '.': case '>': return '.'
    case '/': case '?': return '/'
    case '\\': case '|': return '\\'
  }

  if (/^F[1-9][0-9]?$/.test(key)) return key
  if (code.startsWith('Key')) return code.substring(3)
  if (code.startsWith('Digit')) return code.substring(5)
  if (code.startsWith('Numpad')) return code

  return key
}

function findShortcutConflict(
  currentKey: string,
  accelerator: string,
  shortcuts: KeyboardShortcuts
): string | null {
  if (!accelerator) return null
  const cleanAcc = accelerator.trim().toLowerCase()
  for (const [key, val] of Object.entries(shortcuts)) {
    const s = val as KeyboardShortcuts[keyof KeyboardShortcuts]
    if (key !== currentKey && s.enabled && s.accelerator.trim().toLowerCase() === cleanAcc) {
      return key
    }
  }
  return null
}

interface HotkeyRecorderProps {
  actionKey: string
  value: string
  onChange: (newValue: string) => void
  shortcuts: KeyboardShortcuts
  t: ReturnType<typeof useTranslation>['t']
}

function HotkeyRecorder({ actionKey, value, onChange, shortcuts, t }: HotkeyRecorderProps): JSX.Element {
  const [recording, setRecording] = useState(false)
  const [tempValue, setTempValue] = useState('')

  const formatDisplay = (val: string): string => {
    if (!val) return t.settings.keyboard.empty
    return val
      .replace(/CommandOrControl/g, 'Ctrl')
      .replace(/CmdOrCtrl/g, 'Ctrl')
      .replace(/Control/g, 'Ctrl')
      .replace(/Meta/g, 'Win')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    e.preventDefault()
    e.stopPropagation()

    const key = e.key
    if (key === 'Escape') {
      setRecording(false)
      e.currentTarget.blur()
      return
    }

    if ((key === 'Backspace' || key === 'Delete') && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
      onChange('')
      setRecording(false)
      e.currentTarget.blur()
      return
    }

    const isModifier = ['Control', 'Shift', 'Alt', 'Meta'].includes(key)
    const parts: string[] = []
    if (e.ctrlKey) parts.push('Ctrl')
    if (e.shiftKey) parts.push('Shift')
    if (e.altKey) parts.push('Alt')
    if (e.metaKey) parts.push('Cmd')

    if (!isModifier) {
      const normalized = normalizeKey(key, e.code)
      if (normalized) parts.push(normalized)
      onChange(parts.join('+'))
      setRecording(false)
      e.currentTarget.blur()
    } else {
      setTempValue(parts.join('+') + ' + …')
    }
  }

  const conflictKey = findShortcutConflict(actionKey, value, shortcuts)
  const hasConflict = !!conflictKey

  let inputClass = 'form-input hotkey-input'
  if (recording) inputClass += ' is-recording'
  else if (hasConflict) inputClass += ' has-conflict'
  else if (value) inputClass += ' has-value'
  else inputClass += ' is-empty'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      <Tooltip label={value ? formatDisplay(value) : t.settings.keyboard.emptyHint} placement="bottom">
        <input
          type="text"
          className={inputClass}
          readOnly
          value={recording ? tempValue : formatDisplay(value)}
          onFocus={() => {
            setRecording(true)
            setTempValue(t.settings.keyboard.recording)
          }}
          onBlur={() => {
            setRecording(false)
            setTempValue('')
          }}
          onKeyDown={handleKeyDown}
          placeholder={t.settings.keyboard.accelerator}
        />
      </Tooltip>
      {hasConflict && (
        <span style={{
          fontSize: 9,
          color: 'var(--orange)',
          marginTop: 2,
          textAlign: 'left',
          display: 'block'
        }}>
          {t.settings.keyboard.validation.conflict}
        </span>
      )}
    </div>
  )
}

interface SettingsPanelProps {
  onClose?: () => void
}

export default function SettingsPanel({ onClose }: SettingsPanelProps): JSX.Element {
  const { closePanel: storeClosePanel, openPanel, detectedUserName } = useUIStore()
  const closePanel = onClose || storeClosePanel
  const { settings, save } = useSettingsStore()
  const { feeds, folders, loadAll, deleteAllFeeds } = useFeedsStore()
  const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm()
  const { alert, alertState, handleClose } = useAlert()
  const [local, setLocal] = useState<AppSettings>({ ...settings })
  const [importing, setImporting] = useState(false)
  const [opmlImporting, setOpmlImporting] = useState(false)
  const [displays, setDisplays] = useState<DisplayInfo[]>([])
  const [testing, setTesting] = useState(false)
  const initialTab = useUIStore((s) => s.settingsInitialTab) as ActiveTab | null
  const settingsFocusField = useUIStore((s) => s.settingsFocusField)
  const [activeTab, setActiveTab] = useState<ActiveTab>(initialTab || 'general')
  const panelRef = useRef<HTMLDivElement>(null)
  const userNameInputRef = useRef<HTMLInputElement>(null)
  const closeAfterNameConfirmRef = useRef(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [newPriorityInput, setNewPriorityInput] = useState('')
  const [newMuteInput, setNewMuteInput] = useState('')
  const [autoBackupsList, setAutoBackupsList] = useState<AutoBackupFileInfo[]>([])
  const [loadingAutoBackups, setLoadingAutoBackups] = useState(false)
  const [runningAutoBackup, setRunningAutoBackup] = useState(false)
  const [actionFile, setActionFile] = useState<string | null>(null)
  const [appVersion, setAppVersion] = useState('')
  const { t } = useTranslation()

  const fetchAutoBackups = useCallback(async () => {
    setLoadingAutoBackups(true)
    try {
      const list = await window.api.listAutoBackups()
      setAutoBackupsList(list)
    } catch {
      setAutoBackupsList([])
    } finally {
      setLoadingAutoBackups(false)
    }
  }, [])

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab)
      useUIStore.setState({ settingsInitialTab: null })
    }
  }, [initialTab])

  useEffect(() => {
    if (settingsFocusField !== 'userName') return

    setActiveTab('general')
    const frame = window.requestAnimationFrame(() => {
      userNameInputRef.current?.focus()
      userNameInputRef.current?.select()
      useUIStore.setState({ settingsFocusField: null })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [settingsFocusField])

  useEffect(() => {
    if (activeTab === 'backupMaintenance') {
      void fetchAutoBackups()
    }
  }, [activeTab, fetchAutoBackups])

  const localRef = useRef(local)
  const saveGen = useRef(0)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const peekTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startPeeking = useCallback((target: HTMLElement) => {
    const overlay = target.closest('.panel-overlay')
    if (!overlay) return

    overlay.classList.add('is-peeking')
    if (peekTimer.current) clearTimeout(peekTimer.current)

    peekTimer.current = setTimeout(() => {
      overlay.classList.remove('is-peeking')
    }, 1200)

    const stopPeeking = (): void => {
      if (peekTimer.current) clearTimeout(peekTimer.current)
      peekTimer.current = setTimeout(() => {
        overlay.classList.remove('is-peeking')
      }, 120)
      window.removeEventListener('pointerup', stopPeeking)
      window.removeEventListener('mouseup', stopPeeking)
      window.removeEventListener('touchend', stopPeeking)
      window.removeEventListener('pointercancel', stopPeeking)
    }

    window.addEventListener('pointerup', stopPeeking)
    window.addEventListener('mouseup', stopPeeking)
    window.addEventListener('touchend', stopPeeking)
    window.addEventListener('pointercancel', stopPeeking)
  }, [])

  useEffect(() => {
    return () => {
      if (peekTimer.current) clearTimeout(peekTimer.current)
      document.querySelectorAll('.panel-overlay.is-peeking').forEach((el) => el.classList.remove('is-peeking'))
    }
  }, [])

  useEffect(() => {
    localRef.current = local
  }, [local])

  useEffect(() => {
    const incoming = settings.notifications.feedFilters ?? []
    setLocal((prev) => {
      const current = prev.notifications.feedFilters ?? []
      if (incoming.length === current.length && incoming.every((id) => current.includes(id))) {
        return prev
      }
      const next = {
        ...prev,
        notifications: { ...prev.notifications, feedFilters: incoming }
      }
      localRef.current = next
      return next
    })
  }, [settings.notifications.feedFilters])

  useEffect(() => {
    window.api.getDisplays().then((raw: DisplayInfo[]) => {
      setDisplays(raw.map(d => ({
        id: d.id,
        label: d.label,
        bounds: d.bounds,
        isPrimary: d.isPrimary
      })))
    })
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
    }
  }, [])

  useEffect(() => {
    window.api.getVersions()
      .then((versions) => setAppVersion((versions as AppVersionInfo).app))
      .catch(() => setAppVersion(''))
  }, [])

  const persist = useCallback((next: AppSettings, debounceMs = 0) => {
    setLocal(next)
    localRef.current = next

    if (debounceTimer.current) clearTimeout(debounceTimer.current)

    const run = async (): Promise<void> => {
      const toSave = localRef.current
      const gen = ++saveGen.current

      // Only show "Saving…" if the write actually takes a moment — fast IPC
      // saves would otherwise flash and look like a glitch before "Saved".
      const slowTimer = setTimeout(() => {
        if (gen === saveGen.current) setSaveStatus('saving')
      }, 450)

      try {
        await save(toSave)
        clearTimeout(slowTimer)
        if (gen !== saveGen.current) return
        setSaveStatus('saved')
        if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
        feedbackTimer.current = setTimeout(() => {
          if (gen === saveGen.current) setSaveStatus('idle')
        }, 2200)
      } catch {
        clearTimeout(slowTimer)
        if (gen !== saveGen.current) return
        setSaveStatus('error')
        if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
        feedbackTimer.current = setTimeout(() => {
          if (gen === saveGen.current) setSaveStatus('idle')
        }, 2500)
      }
    }

    if (debounceMs > 0) {
      // Keep current feedback stable while coalescing slider/number edits.
      debounceTimer.current = setTimeout(() => { void run() }, debounceMs)
    } else {
      void run()
    }
  }, [save])

  const update = (partial: Partial<AppSettings>, debounceMs = 0): void => {
    persist({ ...localRef.current, ...partial }, debounceMs)
  }

  const handleUserNameKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key !== 'Enter') return

    e.preventDefault()
    update({ userName: e.currentTarget.value.trim() })
    closeAfterNameConfirmRef.current = true
    window.requestAnimationFrame(() => panelRef.current?.focus())
  }

  const handlePanelKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key !== 'Enter' || e.defaultPrevented || !closeAfterNameConfirmRef.current) return

    e.preventDefault()
    closeAfterNameConfirmRef.current = false
    closePanel()
  }

  const handleOpenAbout = (): void => {
    closePanel()
    window.setTimeout(() => openPanel('about'), 220)
  }

  const updateNotif = (partial: Partial<AppSettings['notifications']>, debounceMs = 0): void => {
    const cur = localRef.current
    persist({ ...cur, notifications: { ...cur.notifications, ...partial } }, debounceMs)
  }

  const previewNow = (playSound = true): void => {
    void window.api.previewNotification(localRef.current.notifications, playSound)
  }

  const handleAddPriorityKeyword = (e?: React.FormEvent): void => {
    if (e) e.preventDefault()
    const val = newPriorityInput.trim()
    if (!val) return
    const current = local.filters?.priorityKeywords ?? []
    if (current.some((k) => k.toLowerCase() === val.toLowerCase())) {
      setNewPriorityInput('')
      return
    }
    const next = [...current, val]
    update({ filters: { ...(local.filters || DEFAULT_SETTINGS.filters), priorityKeywords: next } })
    setNewPriorityInput('')
  }

  const handleRemovePriorityKeyword = (keyword: string): void => {
    const current = local.filters?.priorityKeywords ?? []
    const next = current.filter((k) => k !== keyword)
    update({ filters: { ...(local.filters || DEFAULT_SETTINGS.filters), priorityKeywords: next } })
  }

  const handleAddMuteKeyword = (e?: React.FormEvent): void => {
    if (e) e.preventDefault()
    const val = newMuteInput.trim()
    if (!val) return
    const current = local.filters?.muteKeywords ?? []
    if (current.some((k) => k.toLowerCase() === val.toLowerCase())) {
      setNewMuteInput('')
      return
    }
    const next = [...current, val]
    update({ filters: { ...(local.filters || DEFAULT_SETTINGS.filters), muteKeywords: next } })
    setNewMuteInput('')
  }

  const handleRemoveMuteKeyword = (keyword: string): void => {
    const current = local.filters?.muteKeywords ?? []
    const next = current.filter((k) => k !== keyword)
    update({ filters: { ...(local.filters || DEFAULT_SETTINGS.filters), muteKeywords: next } })
  }

  const handleMuteActionChange = (action: 'hide' | 'autoRead'): void => {
    update({ filters: { ...(local.filters || DEFAULT_SETTINGS.filters), muteAction: action } })
  }

  const toggleIgnoredFeed = (feedId: string): void => {
    const current = localRef.current.notifications.feedFilters ?? []
    const feedFilters = current.includes(feedId)
      ? current.filter((id) => id !== feedId)
      : [...current, feedId]
    updateNotif({ feedFilters })
  }

  const ignoredFeedGroups = (() => {
    const sortedFolders = [...folders].sort((a, b) => a.name.localeCompare(b.name))
    const sortedFeeds = [...feeds].sort((a, b) => a.title.localeCompare(b.title))
    const groups: { id: string; name: string; feeds: typeof sortedFeeds }[] = []
    for (const folder of sortedFolders) {
      const inFolder = sortedFeeds.filter((f) => f.folderId === folder.id)
      if (inFolder.length > 0) groups.push({ id: folder.id, name: folder.name, feeds: inFolder })
    }
    const unfiled = sortedFeeds.filter((f) => !f.folderId)
    if (unfiled.length > 0) {
      groups.push({ id: '', name: t.addFeed.noFolder, feeds: unfiled })
    }
    return groups
  })()
  const mutedCount = (local.notifications.feedFilters ?? []).length

  const updateShortcuts = (shortcuts: KeyboardShortcuts): void => {
    persist({ ...localRef.current, shortcuts })
  }

  const handleExportBackup = async (): Promise<void> => {
    const result = await window.api.exportBackup()
    if (result.ok) {
      await alert({
        title: t.settings.backup.dialogs.exportSuccessTitle,
        message: t.settings.backup.dialogs.exportSuccessMsg,
        variant: 'success'
      })
    }
  }

  const handleImportBackup = async (): Promise<void> => {
    const confirmed = await confirm({
      title: t.settings.backup.dialogs.importTitle,
      message: t.settings.backup.dialogs.importMsg,
      confirmText: t.settings.backup.dialogs.importBtn,
      cancelText: t.sidebar.cancel,
      variant: 'warning'
    })
    if (!confirmed) return
    setImporting(true)
    const result = await window.api.importBackup()
    setImporting(false)
    if (result.ok) {
      await alert({
        title: t.settings.backup.dialogs.importSuccessTitle,
        message: t.settings.backup.dialogs.importSuccessMsg,
        variant: 'success'
      })
      window.location.reload()
    } else if (result.error) {
      await alert({
        title: t.settings.backup.dialogs.importFailTitle,
        message: t.settings.backup.dialogs.importFailMsg.replace('{error}', result.error),
        variant: 'error'
      })
    }
  }

  const handleRunAutoBackup = async (): Promise<void> => {
    setRunningAutoBackup(true)
    try {
      const result = await window.api.runAutoBackup()
      if (result.ok) {
        await alert({
          title: t.settings.autoBackup.dialogs.runSuccessTitle,
          message: t.settings.autoBackup.dialogs.runSuccessMsg,
          variant: 'success'
        })
        const updated = await window.api.getSettings()
        setLocal(updated)
        localRef.current = updated
        await fetchAutoBackups()
      } else {
        await alert({
          title: t.settings.autoBackup.dialogs.runFailTitle,
          message: t.settings.autoBackup.dialogs.runFailMsg.replace('{error}', result.error || 'Unknown error'),
          variant: 'error'
        })
      }
    } finally {
      setRunningAutoBackup(false)
    }
  }

  const handlePickBackupFolder = async (): Promise<void> => {
    const folder = await window.api.pickBackupFolder()
    if (folder) {
      const nextBackup = { ...(local.autoBackup || DEFAULT_SETTINGS.autoBackup), customPath: folder }
      update({ autoBackup: nextBackup })
      setTimeout(() => void fetchAutoBackups(), 100)
    }
  }

  const handleResetBackupFolder = (): void => {
    const nextBackup = { ...(local.autoBackup || DEFAULT_SETTINGS.autoBackup), customPath: '' }
    update({ autoBackup: nextBackup })
    setTimeout(() => void fetchAutoBackups(), 100)
  }

  const handleOpenBackupFolder = async (): Promise<void> => {
    await window.api.openBackupFolder()
  }

  const handleRestoreAutoBackup = async (item: AutoBackupFileInfo): Promise<void> => {
    const confirmed = await confirm({
      title: t.settings.autoBackup.dialogs.restoreConfirmTitle,
      message: t.settings.autoBackup.dialogs.restoreConfirmMsg.replace('{file}', item.filename),
      confirmText: t.settings.autoBackup.restoreBtn,
      cancelText: t.sidebar.cancel,
      variant: 'warning'
    })
    if (!confirmed) return

    setActionFile(item.filePath)
    const result = await window.api.restoreAutoBackup(item.filePath)
    setActionFile(null)

    if (result.ok) {
      await alert({
        title: t.settings.autoBackup.dialogs.restoreSuccessTitle,
        message: t.settings.autoBackup.dialogs.restoreSuccessMsg,
        variant: 'success'
      })
      window.location.reload()
    } else {
      await alert({
        title: t.settings.autoBackup.dialogs.restoreFailTitle,
        message: t.settings.autoBackup.dialogs.restoreFailMsg.replace('{error}', result.error || 'Unknown error'),
        variant: 'error'
      })
    }
  }

  const handleDeleteAutoBackup = async (item: AutoBackupFileInfo): Promise<void> => {
    const confirmed = await confirm({
      title: t.settings.autoBackup.dialogs.deleteConfirmTitle,
      message: t.settings.autoBackup.dialogs.deleteConfirmMsg.replace('{file}', item.filename),
      confirmText: t.settings.autoBackup.deleteBtn,
      cancelText: t.sidebar.cancel,
      variant: 'danger'
    })
    if (!confirmed) return

    setActionFile(item.filePath)
    const result = await window.api.deleteAutoBackup(item.filePath)
    setActionFile(null)

    if (result.ok) {
      await fetchAutoBackups()
    } else {
      await alert({
        title: t.settings.autoBackup.dialogs.deleteFailTitle,
        message: t.settings.autoBackup.dialogs.deleteFailMsg.replace('{error}', result.error || 'Unknown error'),
        variant: 'error'
      })
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  const formatBackupTime = (timestamp: number | null | undefined): string => {
    if (!timestamp) return t.settings.autoBackup.status.never
    const d = new Date(timestamp)
    return d.toLocaleString(local.language === 'es' ? 'es-ES' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleImportOpml = async (): Promise<void> => {
    setOpmlImporting(true)
    try {
      const result = await window.api.importOpml() as { canceled?: boolean; added?: number }
      if (result.canceled) return

      await loadAll()
      await alert({
        title: t.settings.backupData.opmlImportSuccessTitle,
        message: t.settings.backupData.opmlImportSuccessMsg.replace('{count}', String(result.added ?? 0)),
        variant: 'success'
      })
    } catch (error) {
      await alert({
        title: t.settings.backupData.opmlImportFailTitle,
        message: t.settings.backupData.opmlImportFailMsg.replace(
          '{error}',
          error instanceof Error ? error.message : String(error)
        ),
        variant: 'error'
      })
    } finally {
      setOpmlImporting(false)
    }
  }

  const handleExportOpml = async (): Promise<void> => {
    try {
      const result = await window.api.exportOpml() as { canceled?: boolean; ok?: boolean }
      if (result.canceled || !result.ok) return

      await alert({
        title: t.settings.backupData.opmlExportSuccessTitle,
        message: t.settings.backupData.opmlExportSuccessMsg,
        variant: 'success'
      })
    } catch (error) {
      await alert({
        title: t.settings.backupData.opmlExportFailTitle,
        message: t.settings.backupData.opmlExportFailMsg.replace(
          '{error}',
          error instanceof Error ? error.message : String(error)
        ),
        variant: 'error'
      })
    }
  }

  const handleResetSettings = async (): Promise<void> => {
    const confirmed = await confirm({
      title: t.settings.backupData.resetSettingsConfirmTitle,
      message: t.settings.backupData.resetSettingsConfirmMsg,
      confirmText: t.settings.backupData.resetSettingsConfirmBtn,
      cancelText: t.sidebar.cancel,
      variant: 'danger'
    })
    if (!confirmed) return

    try {
      const next = structuredClone(DEFAULT_SETTINGS)
      setLocal(next)
      localRef.current = next
      await save(next)
      window.location.reload()
    } catch (error) {
      await alert({
        title: t.settings.backupData.resetSettingsFailTitle,
        message: t.settings.backupData.resetSettingsFailMsg.replace(
          '{error}',
          error instanceof Error ? error.message : String(error)
        ),
        variant: 'error'
      })
    }
  }

  const handleDeleteAllFeeds = async (): Promise<void> => {
    if (feeds.length === 0) return

    const confirmed = await confirm({
      title: t.settings.backupData.deleteFeedsConfirmTitle,
      message: t.settings.backupData.deleteFeedsConfirmMsg.replace('{count}', String(feeds.length)),
      confirmText: t.settings.backupData.deleteFeedsConfirmBtn,
      cancelText: t.sidebar.cancel,
      variant: 'danger'
    })
    if (!confirmed) return

    try {
      const result = await deleteAllFeeds()
      await alert({
        title: t.settings.backupData.deleteFeedsSuccessTitle,
        message: t.settings.backupData.deleteFeedsSuccessMsg.replace('{count}', String(result.deleted)),
        variant: 'success'
      })
      window.location.reload()
    } catch (error) {
      await alert({
        title: t.settings.backupData.deleteFeedsFailTitle,
        message: t.settings.backupData.deleteFeedsFailMsg.replace(
          '{error}',
          error instanceof Error ? error.message : String(error)
        ),
        variant: 'error'
      })
    }
  }

  const positionCells: Array<{
    id: AppSettings['notifications']['position'] | null
    dot: 'tl' | 'tc' | 'tr' | 'bl' | 'bc' | 'br' | 'center' | null
  }> = [
    { id: 'top-left', dot: 'tl' },
    { id: 'top-center', dot: 'tc' },
    { id: 'top-right', dot: 'tr' },
    { id: null, dot: null },
    { id: null, dot: 'center' },
    { id: null, dot: null },
    { id: 'bottom-left', dot: 'bl' },
    { id: 'bottom-center', dot: 'bc' },
    { id: 'bottom-right', dot: 'br' }
  ]

  const navItems: Array<{ id: ActiveTab; label: string; Icon: typeof Bell }> = [
    { id: 'general', label: t.settings.tabs.general, Icon: Sliders },
    { id: 'appearance', label: t.settings.tabs.appearance, Icon: Palette },
    { id: 'filters', label: t.settings.tabs.filters, Icon: Filter },
    { id: 'notifications', label: t.settings.tabs.notifications, Icon: Bell },
    { id: 'keyboard', label: t.settings.tabs.keyboard, Icon: Keyboard },
    { id: 'backupMaintenance', label: t.settings.tabs.backupMaintenance, Icon: Database }
  ]

  const themes: Array<{ id: AppSettings['theme']; label: string }> = [
    { id: 'dark', label: t.settings.general.themes.dark },
    { id: 'grayscale', label: t.settings.general.themes.grayscale },
    { id: 'light', label: t.settings.general.themes.light },
    { id: 'dracula', label: t.settings.general.themes.dracula },
    { id: 'nord', label: t.settings.general.themes.nord },
    { id: 'monokai', label: t.settings.general.themes.monokai }
  ]

  const statusVisible = saveStatus !== 'idle'
  const statusClass =
    saveStatus === 'saved' ? 'is-saved' :
    saveStatus === 'error' ? 'is-error' : ''
  const statusText =
    saveStatus === 'saving' ? t.settings.saving :
    saveStatus === 'saved' ? t.settings.saved :
    saveStatus === 'error' ? t.settings.saveError : ''

  return (
    <div
      ref={panelRef}
      className="panel settings-panel"
      tabIndex={-1}
      onKeyDown={handlePanelKeyDown}
    >
      <div className="settings-layout">
        <aside className="settings-nav">
          <div className="settings-nav-title">
            <Settings size={14} />
            {t.settings.title}
          </div>
          <div className="settings-nav-items">
            {navItems.map(item => (
              <button
                key={item.id}
                type="button"
                className={`settings-nav-btn${activeTab === item.id ? ' active' : ''}`}
                onClick={() => setActiveTab(item.id)}
                style={{ ['--nav-accent' as string]: TAB_META[item.id].accent, ['--nav-soft' as string]: TAB_META[item.id].soft }}
              >
                <span className="settings-nav-ico" aria-hidden="true">
                  <item.Icon size={14} strokeWidth={2.1} />
                </span>
                {item.label}
              </button>
            ))}
          </div>
          <div className="settings-nav-footer">
            <div className={`settings-save-status${statusVisible ? ' is-visible' : ''} ${statusClass}`.trim()}>
              {statusVisible && <span className="settings-save-dot" />}
              {statusText}
            </div>
            <button type="button" className="btn btn-secondary settings-nav-close" onClick={closePanel}>
              {t.settings.close}
            </button>
          </div>
        </aside>

        <div className="settings-content">
          {activeTab === 'general' && (
            <>
              <div className="settings-card">
                <CardTitle icon={Languages} accent={TAB_META.general.accent}>{t.settings.general.language}</CardTitle>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <select
                    className="form-select"
                    value={local.language || 'en'}
                    onChange={e => update({ language: e.target.value as 'en' | 'es' })}
                  >
                    <option value="en">English</option>
                    <option value="es">Español</option>
                  </select>
                </div>
              </div>

              <div className="settings-card">
                <CardTitle icon={Sparkles} accent={TAB_META.general.accent}>{t.settings.general.personalizationTitle}</CardTitle>
                <div className="form-group" style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label className="form-label" style={{ margin: 0 }}>
                      {t.settings.general.userName}
                    </label>
                    {detectedUserName && !local.userName && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {formatDisplayName(detectedUserName)}
                      </span>
                    )}
                  </div>
                  <input
                    ref={userNameInputRef}
                    className="form-input"
                    type="text"
                    maxLength={40}
                    placeholder={
                      detectedUserName
                        ? `${t.settings.general.userNamePlaceholder} (${formatDisplayName(detectedUserName)})`
                        : t.settings.general.userNamePlaceholder
                    }
                    value={local.userName ?? ''}
                    onChange={(e) => update({ userName: e.target.value }, 300)}
                    onKeyDown={handleUserNameKeyDown}
                  />
                  <div className="form-hint" style={{ marginTop: 4 }}>
                    {t.settings.general.userNameHint}
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border-muted)', paddingTop: 12 }}>
                  <label
                    className="toggle"
                    style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => update({ showWelcomeGreeting: local.showWelcomeGreeting === false })}
                  >
                    <div className={`toggle-track ${local.showWelcomeGreeting !== false ? 'on' : ''}`}>
                      <div className="toggle-thumb" />
                    </div>
                    <div>
                      <span style={{ fontSize: 13, color: 'var(--text-primary)', display: 'block' }}>
                        {t.settings.general.showWelcomeGreeting}
                      </span>
                      <span className="form-hint" style={{ marginTop: 2, display: 'block' }}>
                        {t.settings.general.showWelcomeGreetingHint}
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="settings-card">
                <CardTitle icon={RefreshCw} accent={TAB_META.general.accent}>{t.settings.general.pollingTitle}</CardTitle>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                    {t.settings.general.pollingInterval}
                  </span>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <input
                      className="form-input"
                      style={{ width: 64, textAlign: 'center', padding: '4px 6px' }}
                      type="number"
                      min={1}
                      max={1440}
                      value={local.pollingInterval}
                      onChange={e => update({ pollingInterval: Number(e.target.value) }, 300)}
                    />
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>min</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid var(--border-muted)', paddingTop: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <label className="toggle" style={{ margin: 0, flex: 1, minWidth: 200, display: 'inline-flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                      <div
                        className={`toggle-track ${local.fetchOnStartup !== false ? 'on' : ''}`}
                        onClick={() => update({ fetchOnStartup: local.fetchOnStartup === false })}
                      >
                        <div className="toggle-thumb" />
                      </div>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        {t.settings.general.fetchOnStartup}
                      </span>
                    </label>
                    <select
                      className="form-select"
                      disabled={local.fetchOnStartup === false}
                      value={local.fetchOnStartupDelay ?? 15}
                      onChange={e => update({ fetchOnStartupDelay: Number(e.target.value) })}
                      style={{
                        width: 'auto',
                        minWidth: 140,
                        padding: '4px 8px',
                        fontSize: 12,
                        opacity: local.fetchOnStartup === false ? 0.45 : 1
                      }}
                    >
                      <option value={0}>{t.settings.general.fetchOnStartupDelays.s0}</option>
                      <option value={5}>{t.settings.general.fetchOnStartupDelays.s5}</option>
                      <option value={10}>{t.settings.general.fetchOnStartupDelays.s10}</option>
                      <option value={15}>{t.settings.general.fetchOnStartupDelays.s15}</option>
                      <option value={30}>{t.settings.general.fetchOnStartupDelays.s30}</option>
                      <option value={60}>{t.settings.general.fetchOnStartupDelays.m1}</option>
                      <option value={120}>{t.settings.general.fetchOnStartupDelays.m2}</option>
                      <option value={300}>{t.settings.general.fetchOnStartupDelays.m5}</option>
                    </select>
                  </div>

                  <label
                    className="toggle"
                    style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => update({ pollOnlyWhenUnfocused: !local.pollOnlyWhenUnfocused })}
                  >
                    <div className={`toggle-track ${local.pollOnlyWhenUnfocused ? 'on' : ''}`}>
                      <div className="toggle-thumb" />
                    </div>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.3 }}>
                      {t.settings.general.pollOnlyWhenUnfocused}
                    </span>
                  </label>
                  <p className="settings-card-hint" style={{ margin: '6px 0 0 46px' }}>
                    {t.settings.general.pollOnlyWhenUnfocusedHint}
                  </p>
                </div>
              </div>

              <div className="settings-card">
                <CardTitle icon={Search} accent={TAB_META.general.accent}>{t.settings.general.searchTitle}</CardTitle>
                <label
                  className="toggle"
                  style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => update({ instantSearch: local.instantSearch === false ? true : false })}
                >
                  <div className={`toggle-track ${local.instantSearch !== false ? 'on' : ''}`}>
                    <div className="toggle-thumb" />
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.3 }}>
                    {t.settings.general.instantSearch}
                  </span>
                </label>
                <p className="settings-card-hint" style={{ margin: '6px 0 0 46px' }}>
                  {t.settings.general.instantSearchHint}
                </p>
              </div>

              <div className="settings-card">
                <CardTitle icon={BookOpen} accent={TAB_META.general.accent}>{t.settings.general.readingTitle}</CardTitle>
                <label
                  className="toggle"
                  style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => update({ selectionToolbarEnabled: local.selectionToolbarEnabled === false })}
                >
                  <div className={`toggle-track ${local.selectionToolbarEnabled !== false ? 'on' : ''}`}>
                    <div className="toggle-thumb" />
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.3 }}>
                    {t.settings.general.selectionToolbar}
                  </span>
                </label>
                <p className="settings-card-hint" style={{ margin: '6px 0 0 46px' }}>
                  {t.settings.general.selectionToolbarHint}
                </p>

                <label
                  className="toggle"
                  style={{ margin: '14px 0 0', display: 'inline-flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => update({ autoPlayYouTube: !local.autoPlayYouTube })}
                >
                  <div className={`toggle-track ${local.autoPlayYouTube ? 'on' : ''}`}>
                    <div className="toggle-thumb" />
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.3 }}>
                    {t.settings.general.autoPlayYouTube}
                  </span>
                </label>
                <p className="settings-card-hint" style={{ margin: '6px 0 0 46px' }}>
                  {t.settings.general.autoPlayYouTubeHint}
                </p>
              </div>

              <div className="settings-card">
                <CardTitle icon={ExternalLink} accent={TAB_META.general.accent}>{t.settings.general.linksOpenIn}</CardTitle>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select
                    className="form-select"
                    value={local.customBrowserPath ? 'custom' : 'default'}
                    onChange={async e => {
                      if (e.target.value === 'default') {
                        update({ customBrowserPath: '' })
                        return
                      }
                      const path = await window.api.pickBrowser()
                      if (path) update({ customBrowserPath: path })
                    }}
                    style={{ flex: 1 }}
                  >
                    <option value="default">{t.settings.general.openOptions.default}</option>
                    <option value="custom">{t.settings.general.openOptions.custom}</option>
                  </select>
                  <Tooltip label={t.settings.general.pickTooltip} placement="bottom">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={async () => {
                        const path = await window.api.pickBrowser()
                        if (path) update({ customBrowserPath: path })
                      }}
                      style={{
                        fontSize: 12,
                        padding: '4px 10px',
                        color: 'var(--accent)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-2)',
                        cursor: 'pointer'
                    }}
                    >
                      {t.settings.general.pickBtn}
                    </button>
                  </Tooltip>
                </div>
                {local.customBrowserPath && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, wordBreak: 'break-all' }}>
                    {local.customBrowserPath}
                  </div>
                )}
              </div>

              <div className="settings-card">
                <CardTitle icon={Power} accent={TAB_META.general.accent}>{t.settings.tabs.general}</CardTitle>
                <label className="toggle">
                  <div
                    className={`toggle-track ${local.autoStart ? 'on' : ''}`}
                    onClick={() => update({ autoStart: !local.autoStart })}
                  >
                    <div className="toggle-thumb" />
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t.settings.general.startWithWindows}</span>
                </label>
                <label className={`toggle ${!local.autoStart ? 'disabled' : ''}`}>
                  <div
                    className={`toggle-track ${local.startMinimized && local.autoStart ? 'on' : ''}`}
                    onClick={() => { if (local.autoStart) update({ startMinimized: !local.startMinimized }) }}
                  >
                    <div className="toggle-thumb" />
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    {t.settings.general.startMinimized}
                    {!local.autoStart && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>
                        {t.settings.general.requiresStartWithWindows}
                      </span>
                    )}
                  </span>
                </label>
                <label className="toggle" style={{ marginBottom: 0 }}>
                  <div
                    className={`toggle-track ${local.minimizeToTray ? 'on' : ''}`}
                    onClick={() => update({ minimizeToTray: !local.minimizeToTray })}
                  >
                    <div className="toggle-thumb" />
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t.settings.general.minimizeToTray}</span>
                </label>
              </div>
            </>
          )}

          {activeTab === 'appearance' && (
            <>
              <div className="settings-card">
                <CardTitle icon={Palette} accent={TAB_META.appearance.accent}>{t.settings.general.theme}</CardTitle>
                <div className="theme-picker" role="radiogroup" aria-label={t.settings.general.theme}>
                  {themes.map(theme => (
                    <button
                      key={theme.id}
                      type="button"
                      role="radio"
                      aria-checked={local.theme === theme.id}
                      className={`theme-option${local.theme === theme.id ? ' is-active' : ''}`}
                      onClick={() => {
                        document.documentElement.setAttribute('data-theme', theme.id)
                        try { localStorage.setItem('cyberfeeds-theme', theme.id) } catch { /* ignore */ }
                        update({ theme: theme.id })
                      }}
                    >
                      <span className={`theme-swatch theme-swatch--${theme.id}`} aria-hidden="true">
                        <span className="theme-swatch-accent" />
                      </span>
                      <span className="theme-option-label">{theme.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="settings-card">
                <CardTitle icon={LayoutDashboard} accent={TAB_META.appearance.accent}>{t.settings.general.layout}</CardTitle>
                <select
                  className="form-select"
                  value={local.layout}
                  onChange={e => update({ layout: e.target.value as AppSettings['layout'] })}
                >
                  <option value="three-panel">{t.settings.general.layouts.threePanel}</option>
                  <option value="two-panel">{t.settings.general.layouts.twoPanel}</option>
                  <option value="one-panel">{t.settings.general.layouts.onePanel}</option>
                  <option value="horizontal-split">{t.settings.general.layouts.horizontalSplit}</option>
                </select>
                <label className="toggle" style={{ marginTop: 12, marginBottom: 0 }}>
                  <div
                    className={`toggle-track ${local.showArticleThumbnails ? 'on' : ''}`}
                    onClick={() => update({ showArticleThumbnails: !local.showArticleThumbnails })}
                  >
                    <div className="toggle-thumb" />
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t.settings.general.showThumbnails}</span>
                </label>
              </div>

              <div className="settings-card">
                <CardTitle icon={Type} accent={TAB_META.appearance.accent}>{t.settings.fontSizes.title}</CardTitle>
                <p className="settings-card-hint">{t.settings.fontSizes.explanation}</p>
                <div className="form-group">
                  <label className="form-label">
                    {t.settings.fontSizes.sidebar.replace('{size}', String(local.sidebarFontSize ?? 13))}
                  </label>
                  <input
                    type="range"
                    min={10}
                    max={16}
                    step={1}
                    value={local.sidebarFontSize ?? 13}
                    onPointerDown={e => startPeeking(e.currentTarget)}
                    onMouseDown={e => startPeeking(e.currentTarget)}
                    onTouchStart={e => startPeeking(e.currentTarget)}
                    onInput={e => startPeeking(e.currentTarget)}
                    onKeyDown={e => {
                      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) {
                        startPeeking(e.currentTarget)
                      }
                    }}
                    onBlur={e => {
                      const overlay = e.currentTarget.closest('.panel-overlay')
                      if (overlay) {
                        if (peekTimer.current) clearTimeout(peekTimer.current)
                        overlay.classList.remove('is-peeking')
                      }
                    }}
                    onChange={e => {
                      const v = Number(e.target.value)
                      document.documentElement.style.setProperty('--sidebar-font-size', `${v}px`)
                      update({ sidebarFontSize: v }, 400)
                    }}
                    style={{ width: '100%' }}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">
                    {t.settings.fontSizes.articleList.replace('{size}', String(local.listFontSize ?? 13))}
                  </label>
                  <input
                    type="range"
                    min={10}
                    max={16}
                    step={1}
                    value={local.listFontSize ?? 13}
                    onPointerDown={e => startPeeking(e.currentTarget)}
                    onMouseDown={e => startPeeking(e.currentTarget)}
                    onTouchStart={e => startPeeking(e.currentTarget)}
                    onInput={e => startPeeking(e.currentTarget)}
                    onKeyDown={e => {
                      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) {
                        startPeeking(e.currentTarget)
                      }
                    }}
                    onBlur={e => {
                      const overlay = e.currentTarget.closest('.panel-overlay')
                      if (overlay) {
                        if (peekTimer.current) clearTimeout(peekTimer.current)
                        overlay.classList.remove('is-peeking')
                      }
                    }}
                    onChange={e => {
                      const v = Number(e.target.value)
                      document.documentElement.style.setProperty('--list-font-size', `${v}px`)
                      update({ listFontSize: v }, 400)
                    }}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            </>
          )}

          {activeTab === 'filters' && (
            <>
              {/* Priority Topics Card */}
              <div className="settings-card">
                <CardTitle icon={Star} accent={TAB_META.filters.accent}>
                  {t.settings.filters.priorityTitle}
                </CardTitle>
                <p className="form-hint" style={{ marginTop: 0, marginBottom: 14, fontSize: 13, lineHeight: 1.5 }}>
                  {t.settings.filters.priorityDesc}
                </p>

                <form onSubmit={handleAddPriorityKeyword} style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  <input
                    type="text"
                    className="form-input"
                    style={{ flex: 1 }}
                    placeholder={t.settings.filters.priorityPlaceholder}
                    value={newPriorityInput}
                    onChange={(e) => setNewPriorityInput(e.target.value)}
                  />
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={!newPriorityInput.trim()}
                    style={{ padding: '0 14px' }}
                  >
                    <Plus size={14} />
                    <span>{t.settings.filters.addKeyword}</span>
                  </button>
                </form>

                <div className="settings-keyword-chips-container">
                  {(local.filters?.priorityKeywords ?? []).length === 0 ? (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      {t.settings.filters.noKeywords}
                    </span>
                  ) : (
                    (local.filters?.priorityKeywords ?? []).map((kw) => (
                      <span key={kw} className="settings-keyword-chip priority">
                        <Star size={11} fill="var(--star)" color="var(--star)" />
                        <span>{kw}</span>
                        <button
                          type="button"
                          className="settings-keyword-delete"
                          onClick={() => handleRemovePriorityKeyword(kw)}
                          aria-label={`Remove ${kw}`}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Noise & Mute Rules Card */}
              <div className="settings-card">
                <CardTitle icon={Ban} accent="#f85149">
                  {t.settings.filters.muteTitle}
                </CardTitle>
                <p className="form-hint" style={{ marginTop: 0, marginBottom: 14, fontSize: 13, lineHeight: 1.5 }}>
                  {t.settings.filters.muteDesc}
                </p>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid var(--border-muted)' }}>
                  <label className="form-label" style={{ margin: 0, fontSize: 13 }}>
                    {t.settings.filters.muteAction}
                  </label>
                  <select
                    className="form-select"
                    style={{ width: 'auto', minWidth: 200 }}
                    value={local.filters?.muteAction ?? 'hide'}
                    onChange={(e) => handleMuteActionChange(e.target.value as 'hide' | 'autoRead')}
                  >
                    <option value="hide">{t.settings.filters.muteActionHide}</option>
                    <option value="autoRead">{t.settings.filters.muteActionAutoRead}</option>
                  </select>
                </div>

                <form onSubmit={handleAddMuteKeyword} style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  <input
                    type="text"
                    className="form-input"
                    style={{ flex: 1 }}
                    placeholder={t.settings.filters.mutePlaceholder}
                    value={newMuteInput}
                    onChange={(e) => setNewMuteInput(e.target.value)}
                  />
                  <button
                    type="submit"
                    className="btn btn-secondary"
                    disabled={!newMuteInput.trim()}
                    style={{ padding: '0 14px' }}
                  >
                    <Plus size={14} />
                    <span>{t.settings.filters.addKeyword}</span>
                  </button>
                </form>

                <div className="settings-keyword-chips-container">
                  {(local.filters?.muteKeywords ?? []).length === 0 ? (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      {t.settings.filters.noKeywords}
                    </span>
                  ) : (
                    (local.filters?.muteKeywords ?? []).map((kw) => (
                      <span key={kw} className="settings-keyword-chip mute">
                        <span>{kw}</span>
                        <button
                          type="button"
                          className="settings-keyword-delete"
                          onClick={() => handleRemoveMuteKeyword(kw)}
                          aria-label={`Remove ${kw}`}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>
            </>
          )}

          {activeTab === 'notifications' && (
            <>
              {/* Card 1: General Notifications */}
              <div className="settings-card">
                <CardTitle icon={Bell} accent={TAB_META.notifications.accent}>{t.settings.notifications.title}</CardTitle>
                <label className="toggle" style={{ marginBottom: 14 }}>
                  <div
                    className={`toggle-track ${local.notifications.enabled ? 'on' : ''}`}
                    onClick={() => updateNotif({ enabled: !local.notifications.enabled })}
                  >
                    <div className="toggle-thumb" />
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t.settings.notifications.enable}</span>
                </label>

                <label className="toggle" style={{ marginBottom: 14 }}>
                  <div
                    className={`toggle-track ${local.notifications.showThumbnails ? 'on' : ''}`}
                    onClick={() => updateNotif({ showThumbnails: !local.notifications.showThumbnails })}
                  >
                    <div className="toggle-thumb" />
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t.settings.notifications.showThumbnails}</span>
                </label>

                <div className="form-group">
                  <label className="form-label">{t.settings.notifications.displayMode}</label>
                  <select
                    className="form-select"
                    value={local.notifications.displayMode || 'automatic'}
                    onChange={e => updateNotif({ displayMode: e.target.value as AppSettings['notifications']['displayMode'] })}
                  >
                    <option value="automatic">{t.settings.notifications.displayModes.automatic}</option>
                    <option value="detailed">{t.settings.notifications.displayModes.detailed}</option>
                    <option value="compact">{t.settings.notifications.displayModes.compact}</option>
                  </select>
                  <p className="settings-card-hint" style={{ margin: '8px 0 0' }}>
                    {t.settings.notifications.displayModeHint}
                  </p>
                </div>

                <label className="toggle" style={{ marginBottom: 14 }}>
                  <div
                    className={`toggle-track ${local.notifications.disableOnFullscreen ? 'on' : ''}`}
                    onClick={() => updateNotif({ disableOnFullscreen: !local.notifications.disableOnFullscreen })}
                  >
                    <div className="toggle-thumb" />
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t.settings.notifications.disableOnFullscreen}</span>
                </label>

                <div style={{ marginBottom: 14 }}>
                  <label className="toggle" style={{ marginBottom: 6 }}>
                    <div
                      className={`toggle-track ${local.notifications.closeOnViewInApp ? 'on' : ''}`}
                      onClick={() => updateNotif({ closeOnViewInApp: !local.notifications.closeOnViewInApp })}
                    >
                      <div className="toggle-thumb" />
                    </div>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t.settings.notifications.closeOnViewInApp}</span>
                  </label>
                  <p className="settings-card-hint" style={{ margin: '0 0 0 46px' }}>
                    {t.settings.notifications.closeOnViewInAppHint}
                  </p>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{t.settings.notifications.openBehavior}</label>
                  <div className="open-behavior-picker">
                    <button
                      type="button"
                      className={`open-behavior-option${(local.notifications.openBehavior || 'app') === 'app' ? ' is-active' : ''}`}
                      onClick={() => updateNotif({ openBehavior: 'app' })}
                    >
                      {t.settings.notifications.openInApp}
                    </button>
                    <button
                      type="button"
                      className={`open-behavior-option${local.notifications.openBehavior === 'browser' ? ' is-active' : ''}`}
                      onClick={() => updateNotif({ openBehavior: 'browser' })}
                    >
                      {t.settings.notifications.openInBrowser}
                    </button>
                  </div>
                  <p className="settings-card-hint" style={{ margin: '8px 0 0' }}>
                    {t.settings.notifications.openBehaviorHint}
                  </p>
                </div>
              </div>

              {/* Card 2: Display & Position */}
              <div className="settings-card">
                <CardTitle icon={Monitor} accent={TAB_META.notifications.accent}>{t.settings.notifications.displayAndPositionTitle}</CardTitle>
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Monitor size={12} />
                    {t.settings.notifications.displayMonitor}
                  </label>
                  <select
                    className="form-select"
                    value={local.notifications.displayId}
                    onChange={e => {
                      const selectedId = Number(e.target.value)
                      const selectedDisplay = displays.find(d => d.id === selectedId)
                      updateNotif({
                        displayId: selectedId,
                        displayBounds: selectedDisplay?.bounds
                      })
                    }}
                  >
                    <option value={-1}>{t.settings.notifications.activeDisplay}</option>
                    {displays.map(d => (
                      <option key={d.id} value={d.id}>{d.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{t.settings.notifications.position}</label>
                  <div className="notif-placement-row">
                    <div className="position-monitor" role="group" aria-label={t.settings.notifications.position}>
                      {positionCells.map((cell, idx) => {
                        if (!cell.id) {
                          return (
                            <div key={idx} className="position-cell is-spacer">
                              {cell.dot === 'center' && <span className="position-center-mark" />}
                            </div>
                          )
                        }
                        const isActive = local.notifications.position === cell.id
                        return (
                          <Tooltip key={cell.id} label={t.settings.notifications.positions[cell.id]} placement="top">
                            <button
                              type="button"
                              className={`position-cell${isActive ? ' is-active' : ''}`}
                              onClick={() => {
                                updateNotif({ position: cell.id! })
                                previewNow(false)
                              }}
                              aria-label={t.settings.notifications.positions[cell.id]}
                              aria-pressed={isActive}
                            >
                              <span className={`position-dot ${cell.dot}`} />
                            </button>
                          </Tooltip>
                        )
                      })}
                    </div>
                    <button
                      type="button"
                      className={`btn settings-preview-btn${testing ? ' is-sending' : ''}`}
                      disabled={testing}
                      onClick={async () => {
                        setTesting(true)
                        try {
                          await window.api.previewNotification(local.notifications, true)
                        } finally {
                          setTimeout(() => setTesting(false), 700)
                        }
                      }}
                    >
                      {testing ? <Zap size={15} /> : <Bell size={15} />}
                      {testing ? t.settings.notifications.sendingBtn : t.settings.notifications.previewBtn}
                    </button>
                  </div>
                </div>
              </div>

              {/* Card 3: Timing & Stacking */}
              <div className="settings-card">
                <CardTitle icon={Clock} accent={TAB_META.notifications.accent}>{t.settings.notifications.timingTitle}</CardTitle>
                <div className="form-group">
                  <label className="form-label">{t.settings.notifications.duration}</label>
                  <input
                    className="form-input"
                    type="number"
                    min={1}
                    max={60}
                    step={0.5}
                    value={local.notifications.duration ? local.notifications.duration / 1000 : 6}
                    onChange={e => {
                      const val = Number(e.target.value)
                      if (!isNaN(val) && val > 0) {
                        updateNotif({ duration: Math.round(val * 1000) }, 300)
                      }
                    }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">{t.settings.notifications.maxStack}</label>
                  <input
                    className="form-input"
                    type="number"
                    min={1}
                    max={10}
                    value={local.notifications.maxStack}
                    onChange={e => updateNotif({ maxStack: Number(e.target.value) }, 300)}
                  />
                  <p className="settings-card-hint" style={{ margin: '8px 0 0' }}>
                    {t.settings.notifications.maxStackHint}
                  </p>
                </div>

                <div className="form-group">
                  <label className="form-label">{t.settings.notifications.maxHeight}</label>
                  <input
                    className="form-input"
                    type="number"
                    min={35}
                    max={90}
                    step={5}
                    value={
                      local.notifications.maxHeight >= 35 && local.notifications.maxHeight <= 90
                        ? local.notifications.maxHeight
                        : 65
                    }
                    onChange={e => {
                      const value = Number(e.target.value)
                      if (Number.isFinite(value) && value >= 35 && value <= 90) {
                        updateNotif({ maxHeight: value }, 300)
                      }
                    }}
                  />
                  <p className="settings-card-hint" style={{ margin: '8px 0 0' }}>
                    {t.settings.notifications.maxHeightHint}
                  </p>
                </div>

                <div className="form-group">
                  <label className="form-label">{t.settings.notifications.historyLimit}</label>
                  <select
                    className="form-select"
                    value={local.notifications.historyLimit ?? 1000}
                    onChange={e => updateNotif({ historyLimit: Number(e.target.value) })}
                  >
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                    <option value={500}>500</option>
                    <option value={1000}>1000 ({t.settings.notifications.defaultPreset})</option>
                    <option value={2000}>2000</option>
                    <option value={5000}>5000</option>
                    <option value={0}>{t.settings.notifications.unlimited}</option>
                  </select>
                  <p className="settings-card-hint" style={{ margin: '8px 0 0' }}>
                    {t.settings.notifications.historyLimitHint}
                  </p>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{t.settings.notifications.snoozeDuration}</label>
                  <select
                    className="form-select"
                    value={local.notifications.snoozeMinutes ?? 30}
                    onChange={e => updateNotif({ snoozeMinutes: Number(e.target.value) })}
                  >
                    <option value={15}>15m</option>
                    <option value={30}>30m</option>
                    <option value={60}>1h</option>
                    <option value={120}>2h</option>
                    <option value={240}>4h</option>
                    <option value={480}>8h</option>
                    <option value={1440}>24h</option>
                  </select>
                </div>
              </div>

              {/* Card 4: Sound */}
              <div className="settings-card">
                <CardTitle icon={Volume2} accent={TAB_META.notifications.accent}>{t.settings.notifications.soundTitle}</CardTitle>
                <label className="toggle" style={{ marginBottom: 14 }}>
                  <div
                    className={`toggle-track ${local.notifications.soundEnabled ? 'on' : ''}`}
                    onClick={() => updateNotif({ soundEnabled: !local.notifications.soundEnabled })}
                  >
                    <div className="toggle-thumb" />
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t.settings.notifications.soundEnabled}</span>
                </label>

                <div className="form-group" style={{ marginBottom: 0, opacity: local.notifications.soundEnabled ? 1 : 0.5, pointerEvents: local.notifications.soundEnabled ? 'auto' : 'none' }}>
                  <label className="form-label">{t.settings.notifications.alertSound}</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: 12 }}
                      disabled={!local.notifications.soundEnabled}
                      onClick={async () => {
                        const filePath = await window.api.pickSoundFile()
                        if (filePath) updateNotif({ soundFile: filePath })
                      }}
                    >
                      {t.settings.notifications.browseBtn}
                    </button>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {local.notifications.soundFile
                        ? local.notifications.soundFile.split(/[\\/]/).pop()
                        : t.settings.notifications.systemDefaultSound}
                    </span>
                    {local.notifications.soundFile && (
                      <Tooltip label={t.settings.notifications.resetToDefault} placement="bottom">
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ fontSize: 11, padding: '2px 6px' }}
                          disabled={!local.notifications.soundEnabled}
                          onClick={() => updateNotif({ soundFile: null })}
                        >
                          ✕
                        </button>
                      </Tooltip>
                    )}
                  </div>
                </div>
              </div>

              {/* Card 5: Ignored/Muted Feeds */}
              <div className="settings-card">
                <CardTitle
                  icon={BellOff}
                  accent={TAB_META.notifications.accent}
                  badge={
                    mutedCount > 0 ? (
                      <span
                        className="cyber-badge"
                        style={{
                          marginLeft: 'auto',
                          fontSize: 10,
                          padding: '2px 6px',
                          color: 'var(--amber, #d29922)',
                          borderColor: 'var(--amber, #d29922)',
                          background: 'rgba(210, 153, 34, 0.12)',
                          textTransform: 'none',
                          letterSpacing: 'normal',
                          fontWeight: 600
                        }}
                      >
                        {mutedCount === 1
                          ? t.settings.notifications.mutedCountOne
                          : t.settings.notifications.mutedCount.replace('{count}', String(mutedCount))}
                      </span>
                    ) : undefined
                  }
                >
                  {t.settings.notifications.ignoredFeeds}
                </CardTitle>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                  {t.settings.notifications.ignoredFeedsHint}
                </div>
                {feeds.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {t.settings.notifications.ignoredFeedsEmpty}
                  </div>
                ) : (
                  <div className="muted-feeds-list">
                    {ignoredFeedGroups.map((group) => (
                      <div key={group.id || 'unfiled'}>
                        <div className="muted-feeds-group">{group.name}</div>
                        {group.feeds.map((feed) => {
                          const muted = (local.notifications.feedFilters ?? []).includes(feed.id)
                          return (
                            <label key={feed.id} className="muted-feeds-row">
                              <input
                                type="checkbox"
                                checked={muted}
                                onChange={() => toggleIgnoredFeed(feed.id)}
                              />
                              <FeedFavicon icon={feed.icon} title={feed.title} size={14} />
                              <span className="muted-feeds-title">{feed.title}</span>
                            </label>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'keyboard' && (
            <div className="settings-card">
              <CardTitle icon={Keyboard} accent={TAB_META.keyboard.accent}>{t.settings.keyboard.title}</CardTitle>
              <p className="settings-card-hint">{t.settings.keyboard.explanation}</p>

              {Object.entries(local.shortcuts).map(([key, shortcut]) => (
                <div key={key} className="shortcut-row">
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                    {t.settings.keyboard.actions[key as keyof typeof t.settings.keyboard.actions]}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <HotkeyRecorder
                      actionKey={key}
                      value={shortcut.accelerator}
                      onChange={newVal => {
                        const cur = localRef.current.shortcuts
                        const newShortcuts = { ...cur }
                        newShortcuts[key as keyof KeyboardShortcuts] = {
                          ...cur[key as keyof KeyboardShortcuts],
                          accelerator: newVal,
                          enabled: newVal !== ''
                        }
                        updateShortcuts(newShortcuts)
                      }}
                      shortcuts={local.shortcuts}
                      t={t}
                    />
                    {shortcut.accelerator ? (
                      <Tooltip label={t.settings.keyboard.clear} placement="bottom">
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{
                            fontSize: 12,
                            width: 26,
                            height: 26,
                            padding: 0,
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border)',
                            background: 'var(--bg-2)',
                            cursor: 'pointer',
                            color: 'var(--orange)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                        }}
                          onClick={() => {
                            const cur = localRef.current.shortcuts
                            const newShortcuts = { ...cur }
                            newShortcuts[key as keyof KeyboardShortcuts] = {
                              ...cur[key as keyof KeyboardShortcuts],
                              accelerator: '',
                              enabled: false
                            }
                            updateShortcuts(newShortcuts)
                          }}
                        >
                          <X size={12} />
                        </button>
                      </Tooltip>
                    ) : null}
                  </div>
                  <Tooltip label={shortcut.global ? t.settings.keyboard.scopeGlobalHint : t.settings.keyboard.scopeAppHint} placement="bottom">
                    <label
                      className="toggle"
                      style={{ margin: 0 }}
                    >
                      <div
                        className={`toggle-track ${shortcut.global ? 'on' : ''}`}
                        onClick={() => {
                          const cur = localRef.current.shortcuts
                          const newShortcuts = { ...cur }
                          newShortcuts[key as keyof KeyboardShortcuts] = {
                            ...cur[key as keyof KeyboardShortcuts],
                            global: !cur[key as keyof KeyboardShortcuts].global
                          }
                          updateShortcuts(newShortcuts)
                        }}
                      >
                        <div className="toggle-thumb" />
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'inline-block', width: 42, textAlign: 'left' }}>
                        {shortcut.global ? t.settings.keyboard.scopeGlobal : t.settings.keyboard.scopeApp}
                      </span>
                    </label>
                  </Tooltip>
                </div>
              ))}

              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: 11, marginTop: 12 }}
                onClick={async () => {
                  const result = await window.api.resetShortcuts() as { ok?: boolean; shortcuts?: KeyboardShortcuts }
                  if (result?.shortcuts) {
                    persist({ ...localRef.current, shortcuts: result.shortcuts })
                  }
                }}
              >
                {t.settings.keyboard.resetToDefaults}
              </button>
            </div>
          )}

          {activeTab === 'backupMaintenance' && (
            <>
              <div className="settings-card">
                <CardTitle icon={Database} accent={TAB_META.backupMaintenance.accent}>
                  {t.settings.tabs.backupMaintenance}
                </CardTitle>
                <p className="settings-card-hint">{t.settings.backupData.explanation}</p>
              </div>

              <div className="settings-card">
                <CardTitle icon={ShieldCheck} accent={TAB_META.backupMaintenance.accent}>
                  {t.settings.autoBackup.title}
                </CardTitle>
                <p className="settings-card-hint">{t.settings.autoBackup.explanation}</p>

                <label className="toggle" style={{ marginBottom: 14 }}>
                  <div
                    className={`toggle-track ${(local.autoBackup || DEFAULT_SETTINGS.autoBackup).enabled ? 'on' : ''}`}
                    onClick={() => {
                      const cur = local.autoBackup || DEFAULT_SETTINGS.autoBackup
                      update({ autoBackup: { ...cur, enabled: !cur.enabled } })
                    }}
                  >
                    <div className="toggle-thumb" />
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>
                    {t.settings.autoBackup.enabled}
                  </span>
                </label>

                {(local.autoBackup || DEFAULT_SETTINGS.autoBackup).enabled && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">{t.settings.autoBackup.frequency}</label>
                      <select
                        className="form-select"
                        value={(local.autoBackup || DEFAULT_SETTINGS.autoBackup).frequency}
                        onChange={(e) => {
                          const cur = local.autoBackup || DEFAULT_SETTINGS.autoBackup
                          update({ autoBackup: { ...cur, frequency: e.target.value as AutoBackupFrequency } })
                        }}
                      >
                        <option value="onStartup">{t.settings.autoBackup.frequencies.onStartup}</option>
                        <option value="daily">{t.settings.autoBackup.frequencies.daily}</option>
                        <option value="weekly">{t.settings.autoBackup.frequencies.weekly}</option>
                        <option value="monthly">{t.settings.autoBackup.frequencies.monthly}</option>
                      </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">{t.settings.autoBackup.maxBackups}</label>
                      <input
                        className="form-input"
                        type="number"
                        min={1}
                        max={50}
                        value={(local.autoBackup || DEFAULT_SETTINGS.autoBackup).maxBackups}
                        onChange={(e) => {
                          const cur = local.autoBackup || DEFAULT_SETTINGS.autoBackup
                          update({ autoBackup: { ...cur, maxBackups: Math.max(1, Number(e.target.value) || 3) } }, 300)
                        }}
                      />
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, display: 'block' }}>
                        {t.settings.autoBackup.maxBackupsHint}
                      </span>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">{t.settings.autoBackup.backupLocation}</label>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                        <input
                          className="form-input"
                          type="text"
                          readOnly
                          value={(local.autoBackup || DEFAULT_SETTINGS.autoBackup).customPath || t.settings.autoBackup.defaultLocation}
                          style={{ flex: 1, opacity: 0.85, cursor: 'default' }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button type="button" className="btn btn-secondary" style={{ fontSize: 12 }} onClick={handlePickBackupFolder}>
                          <FolderOpen size={13} />
                          {t.settings.autoBackup.browseFolder}
                        </button>
                        <button type="button" className="btn btn-secondary" style={{ fontSize: 12 }} onClick={handleOpenBackupFolder}>
                          <HardDrive size={13} />
                          {t.settings.autoBackup.openFolder}
                        </button>
                        {!!(local.autoBackup || DEFAULT_SETTINGS.autoBackup).customPath && (
                          <button type="button" className="btn btn-secondary" style={{ fontSize: 12 }} onClick={handleResetBackupFolder}>
                            <RotateCcw size={13} />
                            {t.settings.autoBackup.resetLocation}
                          </button>
                        )}
                      </div>
                    </div>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'var(--bg-1)',
                      border: '1px solid var(--border-muted)',
                      borderRadius: 'var(--radius)',
                      padding: '10px 12px',
                      marginTop: 4
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {t.settings.autoBackup.status.lastBackup.replace(
                            '{time}',
                            formatBackupTime((local.autoBackup || DEFAULT_SETTINGS.autoBackup).lastBackupTime)
                          )}
                        </span>
                        {autoBackupsList.length > 0 && (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {t.settings.autoBackup.status.backupCount
                              .replace('{count}', String(autoBackupsList.length))
                              .replace('{size}', formatFileSize(autoBackupsList.reduce((acc, f) => acc + f.sizeBytes, 0)))}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ fontSize: 12 }}
                        onClick={handleRunAutoBackup}
                        disabled={runningAutoBackup}
                      >
                        {runningAutoBackup ? <div className="spinner" style={{ width: 13, height: 13 }} /> : <Save size={13} />}
                        {runningAutoBackup ? t.settings.autoBackup.runningBackup : t.settings.autoBackup.runNowBtn}
                      </button>
                    </div>

                    {/* Available Automatic Backups List */}
                    <div style={{ marginTop: 8 }}>
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <History size={13} />
                        {t.settings.autoBackup.recentBackups}
                      </label>

                      {loadingAutoBackups ? (
                        <div style={{ padding: '12px 0', textAlign: 'center' }}>
                          <div className="spinner" style={{ width: 16, height: 16, margin: '0 auto' }} />
                        </div>
                      ) : autoBackupsList.length === 0 ? (
                        <p className="settings-card-hint" style={{ margin: 0, fontStyle: 'italic' }}>
                          {t.settings.autoBackup.status.noBackups}
                        </p>
                      ) : (
                        <div className="auto-backups-list">
                          {autoBackupsList.map((item) => (
                            <div key={item.filePath} className="auto-backup-item">
                              <div className="auto-backup-info">
                                <div className="auto-backup-filename" title={item.filename}>
                                  {item.filename}
                                </div>
                                <div className="auto-backup-meta">
                                  <span>{formatBackupTime(item.timestamp)}</span>
                                  <span className="auto-backup-badge">{formatFileSize(item.sizeBytes)}</span>
                                </div>
                              </div>
                              <div className="auto-backup-actions">
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  style={{ fontSize: 11, padding: '4px 8px', height: 26 }}
                                  onClick={() => handleRestoreAutoBackup(item)}
                                  disabled={actionFile === item.filePath}
                                >
                                  {actionFile === item.filePath ? (
                                    <div className="spinner" style={{ width: 11, height: 11 }} />
                                  ) : (
                                    <Download size={12} />
                                  )}
                                  {t.settings.autoBackup.restoreBtn}
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  style={{ fontSize: 11, padding: '4px 6px', height: 26, color: 'var(--red)' }}
                                  onClick={() => handleDeleteAutoBackup(item)}
                                  disabled={actionFile === item.filePath}
                                  title={t.settings.autoBackup.deleteBtn}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="settings-card">
                <CardTitle icon={Save} accent={TAB_META.backupMaintenance.accent}>
                  {t.settings.backupData.backupsSection}
                </CardTitle>
                <p className="settings-card-hint">{t.settings.backup.explanation}</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="btn btn-secondary" onClick={handleExportBackup}>
                    <Upload size={14} />
                    {t.settings.backup.exportBtn}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={handleImportBackup} disabled={importing}>
                    {importing ? <div className="spinner" style={{ width: 13, height: 13 }} /> : <Download size={14} />}
                    {t.settings.backup.importBtn}
                  </button>
                </div>
              </div>

              <div className="settings-card">
                <CardTitle icon={FolderOpen} accent={TAB_META.backupMaintenance.accent}>
                  {t.settings.backupData.feedListsSection}
                </CardTitle>
                <p className="settings-card-hint">{t.settings.backupData.opmlExplanation}</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-secondary" onClick={handleImportOpml} disabled={opmlImporting}>
                    {opmlImporting ? <div className="spinner" style={{ width: 13, height: 13 }} /> : <Download size={14} />}
                    {t.settings.backupData.importOpml}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={handleExportOpml}>
                    <Upload size={14} />
                    {t.settings.backupData.exportOpml}
                  </button>
                </div>
              </div>

              <div className="settings-card">
                <CardTitle icon={Wrench} accent={TAB_META.backupMaintenance.accent}>
                  {t.settings.maintenance.title}
                </CardTitle>
                <p className="settings-card-hint">{t.settings.maintenance.explanation}</p>
                <p className="settings-card-hint">{t.settings.maintenance.trashRetention}</p>
                <div className="form-group">
                  <label className="form-label">{t.settings.maintenance.deleteOlder}</label>
                  <input
                    className="form-input"
                    type="number"
                    min={1}
                    value={local.cleanupReadDays}
                    onChange={e => update({ cleanupReadDays: Number(e.target.value) }, 300)}
                  />
                </div>
                <label className="toggle">
                  <div
                    className={`toggle-track ${local.autoCleanup ? 'on' : ''}`}
                    onClick={() => update({ autoCleanup: !local.autoCleanup })}
                  >
                    <div className="toggle-thumb" />
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t.settings.maintenance.autoClean}</span>
                </label>
                <button
                  type="button"
                  className="btn btn-danger"
                  style={{ fontSize: 12, marginTop: 4 }}
                  onClick={() => window.api.cleanup(local.cleanupReadDays)}
                >
                  {t.settings.maintenance.runCleanBtn}
                </button>
              </div>

              <div className="settings-card">
                <CardTitle icon={FolderOpen} accent={TAB_META.backupMaintenance.accent}>
                  {t.settings.backupData.storageSection}
                </CardTitle>
                <p className="settings-card-hint">{t.settings.backupData.storageExplanation}</p>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}
                  onClick={() => window.api.openDataFolder()}
                >
                  <FolderOpen size={14} />
                  {t.settings.backupData.openDataFolder}
                </button>
                <CardTitle icon={Stethoscope} accent={TAB_META.backupMaintenance.accent}>
                  {t.sidebar.feedsDoctor}
                </CardTitle>
                <p className="settings-card-hint">{t.doctor.explanation}</p>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}
                  onClick={() => openPanel('doctor')}
                >
                  <Stethoscope size={14} />
                  {t.sidebar.feedsDoctor}
                </button>
              </div>

              <div className="settings-card settings-card-danger">
                <CardTitle icon={Trash2} accent={TAB_META.backupMaintenance.accent} danger>
                  {t.settings.backupData.dangerSection}
                </CardTitle>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>
                        {t.settings.backupData.resetSettingsTitle}
                      </div>
                      <p className="settings-card-hint" style={{ margin: '4px 0 0' }}>
                        {t.settings.backupData.resetSettingsExplanation}
                      </p>
                    </div>
                    <button type="button" className="btn btn-danger" style={{ fontSize: 12 }} onClick={handleResetSettings}>
                      <RotateCcw size={14} />
                      {t.settings.backupData.resetSettingsButton}
                    </button>
                  </div>

                  <div style={{ borderTop: '1px solid var(--border-muted)', paddingTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>
                        {t.settings.backupData.deleteFeedsTitle}
                      </div>
                      <p className="settings-card-hint" style={{ margin: '4px 0 0' }}>
                        {t.settings.backupData.deleteFeedsExplanation}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-danger"
                      style={{ fontSize: 12 }}
                      onClick={handleDeleteAllFeeds}
                      disabled={feeds.length === 0}
                    >
                      <Trash2 size={14} />
                      {t.settings.backupData.deleteFeedsButton}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      <footer className="settings-app-footer">
        <Tooltip label={t.topBar.about} placement="top">
          <button
            type="button"
            className="settings-footer-brand"
            onClick={handleOpenAbout}
          >
            <span className="settings-footer-brand-line">
              <img src={logoPng} alt="" aria-hidden="true" draggable={false} />
              <span>CyberFeeds <span className="settings-footer-version">v{appVersion || '1.20.0'}</span></span>
            </span>
            <span className="settings-footer-copyright">© 2026 CyberGems</span>
          </button>
        </Tooltip>
      </footer>

      <ConfirmDialog
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        cancelText={confirmState.cancelText}
        variant={confirmState.variant}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />

      <AlertDialog
        isOpen={alertState.isOpen}
        title={alertState.title}
        message={alertState.message}
        confirmText={alertState.confirmText}
        variant={alertState.variant}
        onClose={handleClose}
      />
    </div>
  )
}
