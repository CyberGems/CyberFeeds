## 📰 CyberFeeds {{VERSION}} - Release Notes

Welcome to the official **CyberFeeds {{VERSION}}** release! CyberFeeds is a high-performance, distraction-free desktop RSS/Atom and media aggregator tailored for desktop workflows on Windows.

---

### ⚡ Performance & Stability Highlights

- ⚡ **Incremental Notification & Inbox Rendering (Prevent UI Freezes)**:
  - Fixed a critical performance issue where loading large notification histories (1,000+ items) rendered thousands of active tooltips and DOM elements simultaneously, causing severe UI freezing and high CPU/memory consumption.
  - Implemented progressive batch rendering via `IntersectionObserver` (50 to 80 items per slice) for smooth, stutter-free scrolling across both Notification History and Inbox panels.
  - Extracted and memoized notification card components (`NotifCard`) to eliminate cascading re-renders across the list.
  - Added 500ms batched event throttling for real-time incoming feed notifications to maintain high framerates during intensive background feed polling.
  - Memoized date partitioning and grouping computations using `useMemo` for instant panel transitions.

- 🖥️ **Multi-Monitor Display Restoration & Window Memory**:
  - Fixed window state persistence on minimize-to-tray so the active monitor and display bounds are properly preserved across sessions.
  - `restoreMainWindow` now accurately nudges and restores the window onto the designated saved monitor before maximizing, preventing accidental jumps back to the primary display.
  - Delegated second-instance window activation to the unified window restore handler for consistent multi-display behavior.

- 📖 **Documentation & Community Polish**:
  - Harmonized donation and support guidance across documentation to align with the CyberGems application suite.
  - Reorganized repository share badges for quicker access to Reddit and direct channels.

---

### 📦 Downloads & Packages

| File | Description | Platform |
| :--- | :--- | :--- |
| **`CyberFeeds-{{RAW_VERSION}}-setup.exe`** | 🚀 **Recommended Installer** (NSIS Assisted Setup with Desktop & Start Menu options) | Windows 10 / 11 (x64) |

---

### 🔍 VirusTotal Scan Results (70+ Antivirus Engines)

- 🛡️ **Setup Installer**: [View VirusTotal Inspection Report](https://www.virustotal.com/gui/file/{{INSTALLER_HASH}})  
  *(SHA256: `{{INSTALLER_HASH}}`)*

---

*Crafted with precision by [CyberGems](https://cybergems.org)*
