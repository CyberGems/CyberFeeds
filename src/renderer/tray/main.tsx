import React from 'react'
import ReactDOM from 'react-dom/client'
import { TrayMenu } from './TrayMenu'
import './tray.css'

declare global {
  interface Window {
    api: import('../../preload/index').API
  }
}

const root = document.getElementById('tray-root')
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <TrayMenu />
    </React.StrictMode>
  )
}
