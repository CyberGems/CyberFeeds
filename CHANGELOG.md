# Changelog

Notable changes per release. Prior releases (1.28.0 and earlier) are
summarized in their respective GitHub Releases.

## 1.29.0 (2026-10-29)

### Added

- Settings search: filter-as-you-type bar in the tab column, auto-focused when
  the modal opens. Matches are highlighted (CSS Custom Highlight API) with an
  n/m counter and Enter/Shift+Enter navigation; cards and tabs without matches
  hide while searching; other tabs containing the query appear as jump chips;
  Ctrl+F refocuses the bar and Escape clears it before closing the modal.

### Fixed

- Notification "View" button and card clicks intermittently opened the main
  window without navigating to the article: the event was routed by exclusion
  from the window list and could land on the tray menu window. The main window
  is now addressed by reference.
- Tray menu first-open mispositioning on monitors whose scale differs from the
  primary: the tray icon rect arrived scaled by the wrong display factor and
  the window geometry was not re-stamped after display-scale crossings. The
  menu now anchors to the cursor when the rect is unusable and re-stamps after
  the new DPI context attaches.
- Notification popup auto-hide now respects interaction: the countdown stays
  paused until the cursor verifiably leaves the popup area.
- Text blur on notification card hover removed (the hover translateY re-rasterized
  text at subpixel offsets on scaled displays).

### Changed

- Default show/hide hotkey is now Alt+Shift+R, following the suite Alt+Shift+X
  pattern and always global. Saved legacy Alt+S / Alt+Shift+S values migrate
  automatically; the settings UI no longer offers an app-scoped toggle for it.
- Tray tooltip standardized to the suite middle-dot format with the global
  show/hide shortcut, plus a "Refreshing feeds..." status while fetching.
- Upgraded Electron 34.3.0 to 42.11.10 (Chromium 148, Node 24) with
  better-sqlite3 v13 and @electron/rebuild v4.
- The auto-start card inside General is now titled "System & Startup" /
  "Sistema e inicio" instead of reusing the tab name.
