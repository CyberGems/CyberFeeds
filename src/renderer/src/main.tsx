import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import './styles/global.css'

// Declare global window.api type
declare global {
  interface Window {
    api: import('../../preload/index').API
  }
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)

// Tell main the first paint is ready (avoids white flash on win.show) — CyberViewer pattern
let uiReadySent = false
function notifyUiReady(): void {
  if (uiReadySent) return
  uiReadySent = true
  try {
    window.api.uiReady()
  } catch {
    /* ignore */
  }
}

function scheduleUiReady(): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(notifyUiReady)
  })
  // requestAnimationFrame never fires while the window is hidden (Chromium
  // throttles it), so a timeout fallback keeps the ack flowing on --hidden
  // autostart starts. Main clears its watchdog as soon as it arrives.
  setTimeout(notifyUiReady, 1500)
}

if (document.readyState === 'complete') {
  scheduleUiReady()
} else {
  window.addEventListener('load', scheduleUiReady, { once: true })
}
