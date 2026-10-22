<p align="center">
  <img src="https://raw.githubusercontent.com/CyberGems/CyberFeeds/main/resources/icon.png" width="120" alt="CyberFeeds">
</p>

## 📰 CyberFeeds {{VERSION}}: Release Notes

### 🚀 What's new in this release

<!-- Maintainer: Rewrite the marked paragraph for every release. Use 25-45 words, lead with user-facing changes, and do not repeat the app name or version. -->
<!-- changelog-summary:start -->
New tab mode toggle lets users choose between opening articles in independent tabs or in-place, notification history accurately tracks receipt timestamps independently from publication dates, and polling silences spurious rediscovery notifications.
<!-- changelog-summary:end -->

> **New to CyberFeeds?** A local-first RSS and Atom reader designed for speed, privacy, and focused desktop reading.

---

### ✨ Key Features & Highlights

- 📑 **Configurable tab management & streamlined controls**:
  - New preference in Settings to toggle opening articles in independent tabs or reading them directly in-place.
  - Automatically disables startup tab session options when tab mode is turned off and clears lingering tabs.
  - Removed standalone "Close all tabs" button next to the tab counter to eliminate misclicks with the window close button.
  - Context menu tab actions are cleanly adapted based on your tab mode preference.

- 🔔 **Accurate notification receipt tracking & polling noise suppression**:
  - Added dedicated receipt time tracking (`receivedAt`) distinct from article publication time (`createdAt`), ensuring unread badges and history sorting remain accurate even for backfilled feeds.
  - Background polling now cross-checks article publication dates against feed fetch baselines, preventing auto-cleanup rediscovery cycles from triggering burst notifications for week-old articles.

<details>
<summary><b>🌐 Ver notas de la versión en Español</b></summary>

### 🚀 Novedades de esta versión

El nuevo ajuste de modo de pestañas permite elegir entre abrir artículos en pestañas independientes o en el visor, el historial registra con precisión la hora de recepción independiente de la fecha de publicación, y el sondeo suprime notificaciones repetidas tras limpiezas.

---

### ✨ Novedades destacadas

- 📑 **Gestión configurable de pestañas y controles más limpios**:
  - Nueva opción en Ajustes para activar o desactivar la apertura de artículos en pestañas independientes o verlos directamente en el lector.
  - Deshabilita automáticamente el ajuste de sesión de pestañas al desactivar las pestañas y limpia pestañas activas.
  - Se retiró el botón suelto de "Cerrar todas las pestañas" junto al contador para evitar clics accidentales con la X de la ventana.
  - El menú contextual de artículos oculta las acciones de pestañas si el modo está deshabilitado.

- 🔔 **Registro preciso de hora de recepción y supresión de notificaciones antiguas**:
  - Registro de hora de recepción (`receivedAt`) separado de la fecha de publicación (`createdAt`), manteniendo exacto el contador no visto y el orden del historial.
  - El sondeo periódico filtra artículos re-descubiertos tras limpiezas automáticas, evitando ráfagas de notificaciones para artículos de hace días.

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
