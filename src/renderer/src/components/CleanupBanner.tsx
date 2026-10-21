import React from 'react'
import { Sparkles, X, CheckCircle } from 'lucide-react'
import { useTranslation } from '../hooks/useTranslation'
import Tooltip from './Tooltip'

interface CleanupBannerProps {
  notice: {
    deletedArticles: number
    purgedTrash: number
    manual?: boolean
  }
  onDismiss: () => void
}

export const CleanupBanner: React.FC<CleanupBannerProps> = ({ notice, onDismiss }) => {
  const { t } = useTranslation()

  const hasDeleted = notice.deletedArticles > 0
  const hasPurgedTrash = notice.purgedTrash > 0

  let message = t.settings.maintenance.cleanNoArticles
  if (hasDeleted && hasPurgedTrash) {
    message = t.settings.maintenance.cleanSuccess
      .replace('{count}', notice.deletedArticles.toLocaleString())
      .replace('{trash}', notice.purgedTrash.toLocaleString())
  } else if (hasDeleted) {
    message = t.settings.maintenance.cleanSuccessNoTrash.replace(
      '{count}',
      notice.deletedArticles.toLocaleString()
    )
  }

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '9px 18px',
        background: 'rgba(22, 27, 34, 0.94)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(88, 166, 255, 0.28)',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
        zIndex: 50,
        position: 'relative',
        transition: 'all 0.2s ease',
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: '50%',
            background: hasDeleted ? 'rgba(63, 185, 80, 0.16)' : 'rgba(88, 166, 255, 0.16)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          {hasDeleted ? (
            <CheckCircle size={15} style={{ color: 'var(--green)' }} />
          ) : (
            <Sparkles size={15} style={{ color: 'var(--accent)' }} />
          )}
        </div>
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--text-primary)',
            lineHeight: 1.4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {message}
        </span>
      </div>

      <Tooltip label={t.common.close} placement="left">
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t.common.close}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 26,
            height: 26,
            borderRadius: 6,
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            flexShrink: 0,
            marginLeft: 12,
            transition: 'background 0.15s ease, color 0.15s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
            e.currentTarget.style.color = 'var(--text-primary)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = 'var(--text-secondary)'
          }}
        >
          <X size={15} />
        </button>
      </Tooltip>
    </div>
  )
}
