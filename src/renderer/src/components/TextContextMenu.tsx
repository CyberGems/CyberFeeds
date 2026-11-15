import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Undo2, Redo2, Scissors, Copy, ClipboardPaste, TextCursorInput, Trash2 } from 'lucide-react'
import { textEditCommands, type TextEditCommand } from '@shared/text-edit'
import { useTranslation } from '../hooks/useTranslation'
import { getFieldHistory, recordFieldEdit, restoreFieldEdit } from '../lib/text-edit-history'

const icons = {
  undo: Undo2, redo: Redo2, cut: Scissors, copy: Copy,
  paste: ClipboardPaste, selectAll: TextCursorInput, delete: Trash2
}

interface MenuState {
  field: HTMLElement
  x: number
  y: number
  enabled: Record<TextEditCommand, boolean>
}

function getEditableField(target: EventTarget | null): HTMLElement | null {
  const field = target instanceof Element ? target.closest('input, textarea, [contenteditable]') : null
  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
    if (field.disabled || field.readOnly) return null
    if (field instanceof HTMLInputElement &&
      !['text', 'search', 'url', 'email', 'password', 'tel', 'number', 'date', 'time', 'datetime-local', 'month', 'week'].includes(field.type)) return null
    return field
  }
  return field instanceof HTMLElement && field.isContentEditable ? field : null
}

export default function TextContextMenu(): JSX.Element | null {
  const { t } = useTranslation()
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [active, setActive] = useState<TextEditCommand | null>(null)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const remember = (event: Event): void => {
      const field = getEditableField(event.target)
      if (field) getFieldHistory(field)
    }
    const record = (event: Event): void => {
      const field = getEditableField(event.target)
      if (field) recordFieldEdit(field, event instanceof InputEvent ? event.inputType : '')
    }
    const open = (event: MouseEvent): void => {
      const field = getEditableField(event.target)
      if (!field) {
        setMenu(null)
        return
      }
      event.preventDefault()
      event.stopPropagation()
      field.focus({ preventScroll: true })
      const history = getFieldHistory(field)
      const hasValue = field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement
      const hasSelection = document.queryCommandEnabled('copy') ||
        (hasValue && field.selectionStart !== field.selectionEnd)
      const bounds = field.getBoundingClientRect()
      const next: MenuState = {
        field,
        x: event.clientX || bounds.left,
        y: event.clientY || bounds.bottom,
        enabled: {
          undo: history.undo.length > 0,
          redo: history.redo.length > 0,
          cut: document.queryCommandEnabled('cut'),
          copy: document.queryCommandEnabled('copy'),
          paste: false,
          selectAll: Boolean(hasValue ? field.value : field.textContent),
          delete: hasSelection
        }
      }
      setActive(null)
      setMenu(next)
      void window.api.hasClipboardText?.().then((paste) => {
        setMenu((current) => current === next ? { ...next, enabled: { ...next.enabled, paste } } : current)
      }).catch(() => {})
    }
    document.addEventListener('focusin', remember, true)
    document.addEventListener('beforeinput', remember, true)
    document.addEventListener('input', record, true)
    document.addEventListener('contextmenu', open, true)
    return () => {
      document.removeEventListener('focusin', remember, true)
      document.removeEventListener('beforeinput', remember, true)
      document.removeEventListener('input', record, true)
      document.removeEventListener('contextmenu', open, true)
    }
  }, [])

  useLayoutEffect(() => {
    const el = root.current
    if (!menu || !el) return
    el.style.left = `${Math.max(4, Math.min(menu.x, window.innerWidth - el.offsetWidth - 4))}px`
    el.style.top = `${Math.max(4, Math.min(menu.y, window.innerHeight - el.offsetHeight - 4))}px`
  }, [menu])

  const run = useCallback((command: TextEditCommand): void => {
    if (!menu?.enabled[command] || !menu.field.isConnected) return
    menu.field.focus({ preventScroll: true })
    if (command === 'undo' || command === 'redo') {
      restoreFieldEdit(menu.field, command)
    } else if (window.api.runTextEdit) {
      window.api.runTextEdit(command)
    } else {
      document.execCommand(command)
    }
    setMenu(null)
  }, [menu])

  useEffect(() => {
    if (!menu) return
    const close = (): void => setMenu(null)
    const onPointerDown = (event: PointerEvent): void => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) close()
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Tab') {
        close()
        return
      }
      if (!['Escape', 'ArrowUp', 'ArrowDown', 'Enter'].includes(event.key)) return
      event.preventDefault()
      event.stopPropagation()
      if (event.key === 'Escape') close()
      else if (event.key === 'Enter' && active) run(active)
      else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        const enabled = textEditCommands.filter((command) => menu.enabled[command])
        if (!enabled.length) return
        const index = active ? enabled.indexOf(active) : -1
        const next = event.key === 'ArrowDown' ? (index + 1) % enabled.length
          : (index <= 0 ? enabled.length - 1 : index - 1)
        setActive(enabled[next])
      }
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKey, true)
    window.addEventListener('blur', close)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKey, true)
      window.removeEventListener('blur', close)
    }
  }, [active, menu, run])

  if (!menu) return null
  return createPortal(
    <div
      ref={root}
      className="ctx-menu text-context-menu"
      data-text-context-menu
      role="menu"
      onMouseDown={(event) => event.preventDefault()}
    >
      {textEditCommands.map((command) => {
        const Icon = icons[command]
        return (
          <button
            key={command}
            type="button"
            role="menuitem"
            tabIndex={-1}
            disabled={!menu.enabled[command]}
            className={`ctx-item${active === command ? ' is-active' : ''}`}
            onClick={() => run(command)}
          >
            <Icon size={14} aria-hidden="true" />
            {t.mainProcess.webviewCtx[command]}
          </button>
        )
      })}
    </div>,
    document.body
  )
}
