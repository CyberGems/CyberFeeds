## 📰 CyberFeeds {{VERSION}} - Release Notes

Welcome to the official **CyberFeeds {{VERSION}}** release! CyberFeeds is a high-performance, distraction-free desktop RSS/Atom and media aggregator tailored for desktop workflows on Windows.

---

### ✨ Key Features & Highlights

- 🎬 **Enhanced YouTube Playback & In-App Player Stability**:
  - Resolved YouTube embed error 153 by injecting canonical Referer headers and sanitizing request headers for video embeds.
  - Added a dedicated setting in Reading Preferences to toggle between in-app YouTube video playback and opening directly in your default browser.
  - Embedded YouTube players now initialize cleanly in a paused state when opening articles.
  - Enlarged and refined the interactive play button overlay on video thumbnails.

- 💎 **Modern Squircle Branding & Bidirectional Tray Animation**:
  - Refreshed application icons with a sleek squircle design across all resolutions and taskbar shortcuts.
  - Added a smooth bidirectional tray icon animation (frames ping-ponging smoothly) to indicate active background feed polling.
  - Synchronized tray context menu with real-time recent articles, displaying titles and timestamps for one-click access.

- 🚀 **Interactive Update Dialog with Changelog Preview**:
  - Redesigned update notification modal with an instant release notes peek, letting you review highlights before updating.
  - Added flexible update controls: update immediately, view full notes, or skip the current release version.

- 📖 **Reader & Text Selection Polish**:
  - Fixed article title selection to allow highlighting from the very first character without drag boundary clipping.
  - Seamless integration with the floating selection toolbar for rapid copying, Google searches, or translation.

- 🔔 **Smarter Notifications & Dynamic Badges**:
  - Notification badges now adaptively adopt your active theme accent color and switch to an alert indicator when reaching the configured history limit.
  - Enhanced compact notification cards with clearer relative timestamps, improved spacing, and stable card dimensions.
  - Moved muted feeds indicator to a clean header badge in Settings to eliminate layout shifts.

- 🎨 **About Modal & Suite Alignment**:
  - Harmonized About modal footer with CyberGems ecosystem standards, featuring updated icon layouts and an animated support badge.
  - Full bilingual coverage across English and Spanish for all new preferences and dialogues.

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
