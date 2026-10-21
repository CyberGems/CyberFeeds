<p align="center">
  <img src="https://raw.githubusercontent.com/CyberGems/CyberFeeds/main/resources/icon.png" width="120" alt="CyberFeeds">
</p>

## 📰 CyberFeeds {{VERSION}}: Release Notes

### 🚀 What's new in this release

<!-- Maintainer: Rewrite the marked paragraph for every release. Use 25-45 words, lead with user-facing changes, and do not repeat the app name or version. -->
<!-- changelog-summary:start -->
Tray menu introduces floating quick panel cards with live window state indicators, article cards add video identification badges, media filtering executes instantly with indexed queries, and notification batch stacks gain refined mute controls.
<!-- changelog-summary:end -->

> **New to CyberFeeds?** A local-first RSS and Atom reader designed for speed, privacy, and focused desktop reading.

---

### ✨ Key Features & Highlights

- 💎 **Modernized quick-panel tray menu**:
  - The system tray context menu is redesigned as a sleek glassmorphism quick panel card aligned with CyberGems suite standards.
  - Displays real-time window visibility status (Visible, Minimized, or Hidden) with instant toggle action.
  - Interactive brand logo with micro-zoom animation and refined theme accents across action buttons.

- 🎬 **Video badges & instant media filtering**:
  - Article cards in the main feed list now display distinct video badges for posts with embedded YouTube, Vimeo, or web videos.
  - Video filter queries now utilize an indexed database column (`hasVideo`), executing in under 1 ms and eliminating UI lag over large libraries.
  - Embedded player links reliably open in your preferred browser configured in Settings.

- 🔔 **Notification stack stability & quick mute**:
  - Notification popups maintain scroll stability across incoming batches without disruptive position resets.
  - Direct in-toast feed mute action silences high-frequency feeds and decrements unread counters seamlessly.

<details>
<summary><b>🌐 Ver notas de la versión en Español</b></summary>

### 🚀 Novedades de esta versión

El menú de la bandeja incorpora tarjetas flotantes con indicadores del estado de la ventana en tiempo real, las tarjetas de artículos añaden distintivos para videos, el filtrado multimedia se ejecuta instantáneamente con consultas indexadas y las notificaciones incorporan controles refinados para silenciar feeds.

---

### ✨ Novedades destacadas

- 💎 **Menú de bandeja modernizado con panel rápido**:
  - El menú contextual de la bandeja se rediseña como una tarjeta flotante de estilo cristal alineada a la suite CyberGems.
  - Muestra el estado de la ventana en tiempo real (Visible, Minimizada u Oculta) con acceso rápido de alternancia.
  - Logotipo interactivo con microanimación de zoom al pasar el cursor y colores de acento refinados.

- 🎬 **Distintivos de video y filtrado instantáneo**:
  - Las tarjetas de artículos muestran una insignia distintiva de video en publicaciones con contenido multimedia de YouTube, Vimeo y web.
  - El filtro de videos ahora utiliza una columna indexada (`hasVideo`), ejecutándose en menos de 1 ms y eliminando cualquier retraso en bibliotecas masivas.
  - Los enlaces a reproductores externos respetan fielmente el navegador web seleccionado en Configuración.

- 🔔 **Estabilidad de notificaciones y silencio rápido**:
  - Las notificaciones emergentes preservan la posición de desplazamiento entre lotes sin reinicios abruptos.
  - Acción rápida para silenciar feeds directamente desde la notificación con actualización inmediata de contadores.

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
