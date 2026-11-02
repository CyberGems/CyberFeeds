import React from 'react'
import { useSettingsStore } from '../store/settings.store'

interface ErrorBoundaryProps {
  children: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

function resolveLanguage(): 'en' | 'es' {
  try {
    const lang = useSettingsStore.getState().settings?.language
    if (lang === 'es' || lang === 'en') return lang
  } catch {
    /* the store itself may be broken, that is why we are in the boundary */
  }
  return navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en'
}

const STRINGS = {
  en: {
    title: 'Something went wrong',
    body: 'The interface stopped unexpectedly. Reload to continue.',
    reload: 'Reload'
  },
  es: {
    title: 'Algo salió mal',
    body: 'La interfaz dejó de funcionar inesperadamente. Recarga para continuar.',
    reload: 'Recargar'
  }
}

// Last line of defense in the renderer: an uncaught React error unmounts the
// whole tree and leaves a blank window. This boundary keeps the window alive
// with a themed fallback and a manual reload. It must not depend on IPC or any
// async store state, because a crash can happen before those finish loading.
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
    return { hasError: true }
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    console.error('[ErrorBoundary] Uncaught renderer error:', error, info.componentStack)
  }

  render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children
    const t = STRINGS[resolveLanguage()]
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          background: 'var(--bg-0, #0d1117)',
          color: 'var(--text-primary, #e6edf3)',
          textAlign: 'center',
          padding: 24
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{t.title}</h2>
        <p style={{ margin: 0, color: 'var(--text-secondary, #8b949e)', fontSize: 13 }}>{t.body}</p>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: 8,
            padding: '8px 20px',
            borderRadius: 8,
            border: '1px solid var(--bg-3, #30363d)',
            background: 'var(--accent, #58a6ff)',
            color: '#0d1117',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          {t.reload}
        </button>
      </div>
    )
  }
}
