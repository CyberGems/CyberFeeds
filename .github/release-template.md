<p align="center">
  <img src="https://raw.githubusercontent.com/CyberGems/CyberFeeds/main/resources/icon.png" width="120" alt="CyberFeeds">
</p>

## 📰 CyberFeeds {{VERSION}}: Release Notes

### 🚀 What's new in this release

<!-- IMPORTANT FOR AGENTS & MAINTAINERS: Always rewrite this entire section and highlights with the ACTUAL release notes for this specific new version before tagging. NEVER leave or copy previous version notes! Use 25-45 words for the summary, lead with user-facing changes, and do not repeat the app name or version. -->
<!-- changelog-summary:start -->
Settings gain a filter-as-you-type search with match highlighting, cross-tab jumps, and keyboard navigation. Notification View and tray menu reliability on mixed-DPI monitors are fixed, the show/hide hotkey joins the Alt+Shift+R suite pattern, and the app upgrades to Electron 42.
<!-- changelog-summary:end -->

> **New to CyberFeeds?** A local-first RSS and Atom reader designed for speed, privacy, and focused desktop reading.

---

### ✨ Key Features & Highlights

- 🔍 **Settings Search**:
  - Filter-as-you-type: settings cards without matches hide while searching, and tabs without matches leave the sidebar.
  - Every match is highlighted with an n/m counter, Enter/Shift+Enter navigation, and automatic scrolling to the current match.
  - Cross-tab chips list other tabs containing the query; the bar is focused when the modal opens, Ctrl+F refocuses it, and Escape clears the query before closing.

- 🖥️ **Tray Menu Reliability on Mixed-DPI Monitors**:
  - The first open after launch now anchors to the real tray icon position on monitors whose scale differs from the primary.
  - Menu geometry is re-stamped after display-scale crossings, ending far-from-taskbar placements.

- 🔔 **Notification Popup Reliability**:
  - "View" and card clicks always reach the reader article, even from a cold tray session.
  - The popup stays open while interacting until the cursor verifiably leaves its area, and hover text blur is gone.

- ⌨️ **Alt+Shift+R Show/Hide Hotkey**:
  - New default following the suite Alt+Shift+X pattern; legacy Alt+S / Alt+Shift+S values migrate automatically.
  - Show/hide is always global, and the tray tooltip now shows it alongside a "Refreshing feeds..." status while fetching.

- 🧱 **Electron 42 Runtime**:
  - Upgraded from Electron 34 to 42 (Chromium 148, Node 24) with better-sqlite3 v13.

<details>
<summary><b>🌐 Ver notas de la versión en Español</b></summary>

### 🚀 Novedades de esta versión

Los ajustes incorporan un buscador con filtro al escribir, resaltado de coincidencias, salto entre pestañas y navegación por teclado. Se corrigen Ver en notificaciones y el menú del tray en DPI mixto; el atajo de mostrar/ocultar pasa a Alt+Shift+R y llega Electron 42.

---

### ✨ Novedades destacadas

- 🔍 **Buscador de ajustes**:
  - Filtro al escribir: las tarjetas sin coincidencias se ocultan y las pestañas sin resultados salen del menú lateral.
  - Todas las coincidencias se resaltan con contador n/m, navegación con Enter/Shift+Enter y desplazamiento automático a la coincidencia actual.
  - Chips de otras pestañas con la consulta; la barra se enfoca al abrir el modal, Ctrl+F la re-enfoca y Escape limpia antes de cerrar.

- 🖥️ **Menú del tray fiable en monitores de DPI mixto**:
  - La primera apertura tras iniciar se ancla a la posición real del icono en monitores con escala distinta a la del primario.
  - La geometría se re-estampa tras los cambios de escala, eliminando las apariciones lejos de la barra de tareas.

- 🔔 **Fiabilidad de las notificaciones**:
  - "Ver" y el click en la tarjeta siempre llegan al artículo, incluso desde una sesión fría del tray.
  - El popup permanece abierto mientras interactúas hasta que el cursor sale de su zona, y el texto borroso en hover desapareció.

- ⌨️ **Atajo Alt+Shift+R para mostrar/ocultar**:
  - Nuevo valor por defecto siguiendo el patrón Alt+Shift+X de la suite; los valores previos Alt+S / Alt+Shift+S migran automáticamente.
  - Siempre global, y el tooltip del tray lo muestra junto al estado "Actualizando feeds..." durante la obtención.

- 🧱 **Runtime Electron 42**:
  - Actualización de Electron 34 a 42 (Chromium 148, Node 24) con better-sqlite3 v13.

</details>

---

### 📦 Downloads & Packages

> ⬇️ **Direct download:** click a file name to download it now. Same files as in **Assets** at the bottom of this page.

| File | Description | Platform |
| :--- | :--- | :--- |
| **[`CyberFeeds-{{RAW_VERSION}}-setup.exe`](https://github.com/CyberGems/CyberFeeds/releases/download/{{VERSION}}/CyberFeeds-{{RAW_VERSION}}-setup.exe)** | 🚀 **Recommended Installer** (NSIS Assisted Setup with Desktop & Start Menu options) | Windows 10 / 11 (x64) |
| **[`CyberFeeds-{{RAW_VERSION}}-portable.exe`](https://github.com/CyberGems/CyberFeeds/releases/download/{{VERSION}}/CyberFeeds-{{RAW_VERSION}}-portable.exe)** | 💼 **Portable Executable** (Zero install, self-contained data directory) | Windows 10 / 11 (x64) |

---

### VirusTotal and SHA256

- **Installer**: [View VirusTotal report](https://www.virustotal.com/gui/file/{{INSTALLER_HASH}}) · SHA256:
  ```text
  {{INSTALLER_HASH}}
  ```
- **Portable archive**: [View VirusTotal report](https://www.virustotal.com/gui/file/{{PORTABLE_HASH}}) · SHA256:
  ```text
  {{PORTABLE_HASH}}
  ```

---

*Crafted with precision by [CyberGems](https://cybergems.org)*
