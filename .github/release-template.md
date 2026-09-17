## 📰 CyberFeeds {{VERSION}} - Release Notes

Welcome to the official **CyberFeeds {{VERSION}}** release! CyberFeeds is a high-performance, distraction-free desktop RSS/Atom and media aggregator tailored for desktop workflows on Windows.

---

### ⚡ Feature & Stability Highlights

- 🔍 **In-Article Text Search with Dynamic Highlighting**:
  - Fast in-article text search accessible via `Ctrl+F` or the dedicated reader toolbar button.
  - Non-destructive DOM `TreeWalker` text marking (`<mark class="reader-search-match">`) with zero interruption or reloading of active media.
  - Live match counter, Next / Previous navigation (`Enter` / `Shift+Enter`), smooth centering into view, and `Escape` to close.
  - Isolated reader body rendering via `React.memo` to eliminate DOM resets during search navigation.
  - Fully bilingual (English and Spanish).

- 📌 **Sticky Header Bar on Scroll**:
  - Full-width reader header bar that smoothly slides down below the toolbar when scrolling past the main article title.
  - Displays the source feed icon and article title with native tooltip metadata and quick "Back to top" action.
  - Smoothly hides when returning to the top of the article.

- 🎬 **Refined Video Filter & Detection Accuracy**:
  - Eliminated false-positive video classifications caused by generic non-video `<iframe>` elements (such as polls, comment boxes, WordPress embed cards, and social widgets).
  - Targeted SQL filtering for verified video providers: YouTube, Vimeo, Rumble, Dailymotion, JW Player, Facebook Video, TikTok, Twitch, BitChute, Streamable, Odysee, and native `<video>` elements.

- ⚡ **Media Player Reliability & Playback Stability**:
  - Protocol-relative `//` embed normalization to `https://`.
  - YouTube player parameters and sandbox policy enhancements.
  - Prevented background article scraping from tearing down active media playback.

---

### 📦 Downloads & Packages

| File | Description | Platform |
| :--- | :--- | :--- |
| **`CyberFeeds-{{RAW_VERSION}}-setup.exe`** | 🚀 **Recommended Installer** (NSIS Assisted Setup with Desktop & Start Menu options) | Windows 10 / 11 (x64) |
| **`CyberFeeds-{{RAW_VERSION}}-portable.exe`** | 💼 **Portable Executable** (Zero install, self-contained data directory) | Windows 10 / 11 (x64) |

---

### 🔍 VirusTotal Scan Results (70+ Antivirus Engines)

- 🛡️ **Setup Installer**: [View VirusTotal Inspection Report](https://www.virustotal.com/gui/file/{{INSTALLER_HASH}})  
  *(SHA256: `{{INSTALLER_HASH}}`)*
- 🛡️ **Portable Executable**: [View VirusTotal Inspection Report](https://www.virustotal.com/gui/file/{{PORTABLE_HASH}})  
  *(SHA256: `{{PORTABLE_HASH}}`)*

---

*Crafted with precision by [CyberGems](https://cybergems.org)*
