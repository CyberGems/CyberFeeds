import React from 'react'
import ReactDOM from 'react-dom/client'
import PipApp from './App'
import '../src/styles/global.css'

declare global {
  interface Window {
    api: import('../../preload/index').API
  }
}

ReactDOM.createRoot(document.getElementById('pip-root') as HTMLElement).render(
  <React.StrictMode>
    <PipApp />
  </React.StrictMode>
)
