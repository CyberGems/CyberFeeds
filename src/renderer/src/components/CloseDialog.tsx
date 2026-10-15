import { useState, useEffect, useCallback } from 'react'
import { Download, Power, X } from 'lucide-react'
import { useTranslation } from '../hooks/useTranslation'
import { useSettingsStore } from '../store/settings.store'
import Tooltip from './Tooltip'

interface CloseDialogProps {
  isOpen: boolean
  onClose: () => void
}

export default function CloseDialog({ isOpen, onClose }: CloseDialogProps): JSX.Element | null {
  const { t } = useTranslation()
  const { update } = useSettingsStore()
  const [remember, setRemember] = useState(false)

  // Reset remember checkbox each time dialog opens
  useEffect(() => {
    if (isOpen) {
      setRemember(false)
    }
  }, [isOpen])

  const chooseAction = useCallback(
    (action: 'tray' | 'quit') => {
      onClose()
      if (remember) {
        update({
          closeChoiceRemembered: true,
          minimizeToTray: action === 'tray'
        })
      }
      void window.api.respondCloseChoice(action, remember)
    },
    [onClose, remember, update]
  )

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }

      const activeTag = (document.activeElement as HTMLElement | null)?.tagName

      if (e.key === 'Enter') {
        if (activeTag === 'BUTTON') return // Native button click handles it
        e.preventDefault()
        chooseAction('tray')
        return
      }

      if (e.key === ' ' || e.code === 'Space') {
        if (activeTag === 'INPUT' || activeTag === 'BUTTON' || activeTag === 'TEXTAREA') return
        e.preventDefault()
        chooseAction('quit')
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, chooseAction, onClose])

  if (!isOpen) return null

  return (
    <div className="close-dialog-overlay" onClick={onClose}>
      <div
        className="close-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="close-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="close-dialog-header">
          <h2 id="close-dialog-title" className="close-dialog-title">
            {t.closeDialog.title}
          </h2>
          <Tooltip label={t.closeDialog.close} placement="bottom">
            <button
              type="button"
              className="close-dialog-close"
              onClick={onClose}
              aria-label={t.closeDialog.close}
            >
              <X size={15} />
            </button>
          </Tooltip>
        </div>

        <div className="close-dialog-body">
          <p className="close-dialog-desc">
            {t.closeDialog.description}
          </p>

          <button
            type="button"
            className="close-dialog-option"
            onClick={() => chooseAction('tray')}
          >
            <span className="close-dialog-icon close-dialog-icon-tray">
              <Download size={17} />
            </span>
            <span className="close-dialog-option-texts">
              <span className="close-dialog-option-title">
                {t.closeDialog.minimizeToTray}
              </span>
              <span className="close-dialog-option-desc">
                {t.closeDialog.minimizeToTrayDesc}
              </span>
            </span>
            <kbd className="modal-key">
              <svg className="modal-key-glyph" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path
                  d="M2 10.5 L7 5.2 L4.8 9 L14.6 9 L14.6 2.5 L17.4 2.5 L17.4 9 A2.8 2.8 0 0 1 14.6 11.8 L4.8 11.8 L7 15.8 Z"
                  fill="currentColor"
                  stroke="none"
                />
              </svg>
            </kbd>
          </button>

          <button
            type="button"
            className="close-dialog-option"
            onClick={() => chooseAction('quit')}
          >
            <span className="close-dialog-icon close-dialog-icon-quit">
              <Power size={17} />
            </span>
            <span className="close-dialog-option-texts">
              <span className="close-dialog-option-title">
                {t.closeDialog.quit}
              </span>
              <span className="close-dialog-option-desc">
                {t.closeDialog.quitDesc}
              </span>
            </span>
            <kbd className="modal-key">
              {t.closeDialog.space}
            </kbd>
          </button>

          <label className="close-dialog-checkbox-label">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="close-dialog-checkbox"
            />
            <span className="close-dialog-checkbox-text">
              {t.closeDialog.rememberChoice}
            </span>
          </label>
        </div>
      </div>
    </div>
  )
}
