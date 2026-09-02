<p align="center">
  <img src="resources/icon.png" width="128" height="128" alt="CyberFeeds Logo" />
</p>

<h1 align="center">CyberFeeds — RSS Reader</h1>

<p align="center">
  <a href="https://github.com/CyberGems/CyberFeeds/releases/latest">
    <img src="https://img.shields.io/badge/⚡_Download_Latest_Release-(Windows_64--bit)-0047B3?style=for-the-badge&logo=windows&logoColor=white" alt="Download Latest Release" />
  </a>
  <a href="https://github.com/CyberGems/CyberFeeds/releases">
    <img src="https://img.shields.io/badge/All_Releases-Changelog-18181B?style=for-the-badge&logo=github&logoColor=white" alt="All Releases" />
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-GPL--3.0-blue.svg" alt="License" />
  <img src="https://img.shields.io/badge/platform-Windows-0078D4.svg?logo=windows&logoColor=white" alt="Platform" />
  <img src="https://img.shields.io/badge/version-1.17.0-00F0FF.svg" alt="Version" />
  <img src="https://img.shields.io/badge/Electron-34-512BD4.svg?logo=electron&logoColor=white" alt="Electron" />
  <a href="https://github.com/CyberGems/CyberFeeds/wiki"><img src="https://img.shields.io/badge/%F0%9F%93%96_Wiki-Documentation-222222?style=flat-square&logo=github&logoColor=white" alt="Wiki" /></a>
</p>

A performance-first, full-featured **RSS/Atom feed reader** built with **Electron + React + TypeScript**. Subscribe to feeds, read articles with full-content extraction, manage your reading flow with star/read/unread/trash, and receive smart notifications when new articles are published.

*Free and open source (GPLv3) — no ads, no tracking, and no data collection. Just enjoy it.*

---

## 📡 Why CyberFeeds?

Most RSS readers are either slow web wrappers or abandoned projects. CyberFeeds is built from the ground up for **performance and usability** — worker threads keep fetching responsive, SQLite WAL mode handles thousands of articles smoothly, and a custom notification system ensures you never miss important updates.

| Need | Solution |
|---|---|
| Follow RSS, Atom, and Reddit | Native support for all formats + Reddit subreddits and user feeds |
| Read full articles | Content extraction via worker threads — no truncated summaries |
| Stay updated | Smart notifications with keyword filtering, snooze, and multi-monitor support |
| Manage large libraries | Virtualized lists, search, star/read/unread, auto-cleanup |
| Migrate from another reader | OPML import/export with folder structure preserved |
| Keep your data | Local SQLite database — no cloud, no accounts, no tracking |

---

## ✨ Key Features

### 📰 Feed Management
- **Universal Feed Support** — RSS, Atom, and XML with automatic discovery
- **Reddit Integration** — Native subreddit and user feed support with fallback chain (RSS → JSON API)
- **OPML Import/Export** — Migrate your feeds with folder structure preserved
- **Feed Preview** — Preview feed content before subscribing
- **Feed Doctor** — Diagnostic scanner for connectivity and parsing issues
- **Background Polling** — Configurable refresh intervals with per-feed and per-folder pause/resume

### 📖 Article Management
- **Full-Content Extraction** — Fetch complete article content via worker threads
- **Star/Unstar** — Mark articles as favorites
- **Read/Unread Tracking** — Know what you've read at a glance
- **Soft Delete** — Move articles to trash with 30-day auto-purge
- **Instant Search** — Search articles with instant or Enter-to-search modes
- **Virtualized Lists** — Smooth scrolling for large article libraries
- **Multiple Layouts** — Three-panel, two-panel, one-panel, and horizontal-split views

### 🔔 Smart Notifications
- **Custom Notification Window** — Built-in notifier with batching and action buttons
- **Keyword Filtering** — Only get notified about topics that matter
- **Snooze** — Pause notifications for a configurable duration
- **Multi-Monitor Support** — Choose which display shows notifications
- **Sound Alerts** — Custom notification sounds
- **Fullscreen Detection** — Suppress notifications during games or videos

### 🖥️ Desktop Integration
- **System Tray** — Minimize to tray, quick actions menu, activity indicator
- **Global Hotkeys** — Configurable shortcuts (default show/hide: `Alt+Shift+S`)
- **Auto-Start** — Start with Windows option
- **Auto-Updates** — Built-in update checker with manual download control
- **Custom Browser** — Open links in a user-selected browser

### 🎨 Customization
- **7 Themes** — Dark, Light, Dracula, Nord, Hacker, Monokai, and Default
- **Reading Preferences** — Font size, line height, max width, reading theme (Default, Sepia, Dark)
- **Bilingual UI** — Full English and Spanish interface

### 💾 Data Management
- **Backup & Restore** — JSON-based backup of feeds, folders, and settings
- **Auto-Cleanup** — Automatically delete old read articles
- **SQLite Database** — High-performance local storage with WAL mode

---

## 🛠️ Tech Stack & Architecture

- **Platform:** Windows (primary target), macOS, Linux
- **Framework:** Electron 34 + React 19 + TypeScript
- **Build:** electron-vite 5 (Vite 6)
- **State:** Zustand 5
- **Database:** better-sqlite3 (WAL mode)
- **Virtualization:** TanStack Virtual
- **Packaging:** electron-builder (NSIS)

```
src/
├── main/                  Electron main process
│   ├── index.ts           App initialization, window creation
│   ├── ipc.ts             IPC channel handlers
│   ├── db.ts              SQLite database layer
│   ├── feed-parse.ts      Feed parsing with fallbacks
│   ├── polling.ts         Background polling orchestration
│   ├── tray.ts            System tray, shortcuts, context menu
│   ├── notifications.ts   Custom notifier window
│   ├── updater.ts         Auto-update lifecycle
│   ├── opml.ts            OPML import/export
│   └── workers/
│       ├── feed-fetcher.worker.ts      Parallel feed fetching
│       └── content-extractor.worker.ts Article content extraction
├── preload/               Context bridge API
│   └── index.ts           window.api exposure
├── renderer/              React application
│   ├── notifier/          Notification window React app
│   └── src/
│       ├── components/    UI components
│       ├── hooks/         Custom React hooks
│       ├── store/         Zustand stores
│       └── styles/        Global CSS and themes
└── shared/                Isolated shared code
    ├── types.ts           Shared TypeScript interfaces
    ├── translations.ts    EN/ES UI strings
    └── reddit.ts          Reddit URL handling
```

### Architecture Highlights

- **Worker Threads** — Feed fetching and content extraction run in dedicated workers to keep the main process responsive
- **Optimistic UI** — Article state updates immediately in the renderer, then syncs with the main process
- **CSS Variable Resizing** — Column/row resizing updates DOM directly during drag (zero React re-renders)
- **Context Bridge** — Strict preload API surface with no Node integration in renderer
- **WAL Mode SQLite** — High-performance concurrent reads with write-ahead logging

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [npm](https://www.npmjs.com/)

### Development

```bash
npm install
npm run dev
```

> **Note:** The `postinstall` script automatically rebuilds `better-sqlite3` for the current Electron version.

### Build

```bash
npm run build          # Production build
npm run build:win      # Windows installer
npm run build:unpack   # Directory output (no installer)
```

### Code Quality

```bash
npm run typecheck      # Type checking
npm run lint           # Linting
npm run format         # Formatting
```

---

## ⌨️ Keyboard Shortcuts

| Key | Action | Scope |
|---|---|---|
| `Alt+Shift+S` | Show/hide CyberFeeds | Global |
| `Escape` | Close panel | Application |

Additional shortcuts (Notifications, Settings, Fetch Now) are configurable in Settings → Keyboard.

---

## ❓ Frequently Asked Questions

### What feed formats does CyberFeeds support?

RSS, Atom, and XML feeds. It also supports Reddit subreddits and user feeds natively, with a fallback chain from RSS to the Reddit JSON API.

### Can I import my feeds from another reader?

Yes. CyberFeeds supports OPML import and export, preserving your folder structure. Go to the sidebar menu and select **Import OPML**.

### How do notifications work?

CyberFeeds has a custom notification system that shows a native-looking popup when new articles are published. You can filter notifications by keywords, snooze them, choose position and monitor, and suppress them during fullscreen applications.

### Where is my data stored?

All data is stored locally in a SQLite database. No cloud sync, no accounts, no tracking. You can export a JSON backup at any time from Settings → Maintenance.

### Does CyberFeeds support macOS and Linux?

Windows is the primary target, but Electron builds for macOS and Linux are supported. Check the releases page for available platforms.

---

## ❤️ Donate

**CyberFeeds** is one of the gems in [CyberGems](https://github.com/CyberGems#-all-apps--repositories), a personal suite I've spent thousands of hours building and refining for my own use. I've decided to share the whole suite with the world — completely free and open-source.

If you'd like to support this work, a donation would mean a lot. Thank you! 🙏

<p align="center">
  <a href="https://www.paypal.com/donate/?hosted_button_id=M4PY3UPJA5Y6Q"><img src="https://img.shields.io/badge/Donate-PayPal-0070BA?style=for-the-badge&logo=paypal" alt="Donate via PayPal" /></a>
</p>

<p align="center">
  <a href="https://ko-fi.com/cybergems"><img src="https://img.shields.io/badge/Support_me_on_Ko--fi-FF5E5B?style=for-the-badge&logo=ko-fi&logoColor=white" alt="Support me on Ko-fi" /></a>
</p>

<p align="center">
  <a href="https://buymeacoffee.com/cybergems"><img src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black" alt="Buy Me a Coffee" /></a>
</p>

<div align="center">

<details>
<summary><b>Crypto donations (BTC, ETH, USDT, LTC) — click to view addresses</b></summary>

| Asset | Address | QR |
|---|---|---|
| **BTC** | <pre><code>bc1q5mxzz05nmvsheqzx7970euswta3fksxzcfzag4</code></pre> | <img src="docs/donate/qr-btc.png" width="90" height="90" alt="BTC QR" /> |
| **ETH** | <pre><code>0x79b703Ec0f77493679Fcd280aF3b983E20c580B8</code></pre> | <img src="docs/donate/qr-eth.png" width="90" height="90" alt="ETH QR" /> |
| **USDT (ERC20 / BEP20)** | <pre><code>0x79b703Ec0f77493679Fcd280aF3b983E20c580B8</code></pre> | <img src="docs/donate/qr-eth.png" width="90" height="90" alt="USDT QR" /> |
| **USDT (TRC20)** | <pre><code>TSVbSk1HSyZ1NprCnAYiw56ECwXgH887mD</code></pre> | <img src="docs/donate/qr-usdt-tron.png" width="90" height="90" alt="USDT TRC20 QR" /> |
| **LTC** | <pre><code>LWGnEHgcFCE2BRkzLnsdPDD8Y8ZeDK577X</code></pre> | <img src="docs/donate/qr-ltc.png" width="90" height="90" alt="LTC QR" /> |

> ⚠️ Send only the selected asset on the indicated network. Using the wrong network will result in permanent loss of funds.

</details>

</div>

---

## 📄 License

CyberFeeds is distributed under the terms of the GNU General Public License v3.0. See [LICENSE](LICENSE) for the full license text.

---

<div align="center" style="background:#0D0F17; border:1px solid rgba(0,255,255,0.12); border-radius:12px; padding:28px 20px; margin-top:32px;">

### Thanks for using CyberFeeds! 🎉

Made by [**CyberGems**](https://cybergems.org)

</div>
