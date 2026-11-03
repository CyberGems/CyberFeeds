# Changelog

Notable changes per release. Prior releases (1.29.0 and earlier) are
summarized in their respective GitHub Releases.

## 1.30.0 (2026-11-03)

### Added

- First-run welcome wizard: a full-window setup shown when the library is
  empty and the profile never completed it. Step 1 picks language and theme
  with live preview, step 2 adds the first feeds (suggestions shared with the
  Add Feed modal, a custom URL, or OPML import), step 3 summarizes and points
  to keyboard basics. Skippable (Esc), and the dev build exposes a preview
  entry in Settings > General.
- Self-recovery for renderer/GPU failures: the main process reloads the
  renderer on crash, watches the first paint and reloads or relaunches with
  GPU caches cleared when the window stays black; relaunches are capped and
  end in an error dialog. Unclean shutdowns (power cuts) clear the GPU caches
  proactively on the next start.
- Persistent main-process logging: console output mirrors to
  `logs/main.log` (rotating, with `uncaughtException`/`unhandledRejection`
  records).
- React ErrorBoundary with a themed reload fallback for uncaught renderer
  errors.
- Press-and-hold on the tab strip navigation buttons glides the strip
  continuously; a quick click keeps the previous jump.
- Failed article thumbnails render a muted image-off placeholder inside the
  fixed-height container.

### Fixed

- Duplicated articles corrupted the virtual list (overlapping rows and
  flicker): pagination now breaks pubDate ties by id and the infinite-scroll
  page merge filters by id, so concurrent refreshes can no longer inject
  duplicate entries.
- Broken thumbnails collapsed their 100px container after measurement on
  every remount, swinging the list height by over a thousand pixels while
  scrolling; the placeholder keeps heights invariant.
- The new-articles pill fragmented into several consecutive pills during a
  fetch wave and applying it moved the list by only a fraction of the
  announced count. Checks now consolidate per wave (trailing debounce) and
  applying loads the full pending count; scrolling back to the top manually
  applies the pending articles in place.
- The "more below" footer indicator read as a clickable button; it is now a
  passive, slightly larger status line.

### Changed

- Add-feed suggestions updated: BBC News replaces Hacker News (its bare RSS
  made a poor first impression) and a single Reddit entry remains.
- The welcome wizard preview entry point (Settings > General) is now
  development-only; production shows just the real first-run flow.

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
