<p align="center">
  <img src="https://raw.githubusercontent.com/CyberGems/CyberFeeds/main/resources/icon.png" width="120" alt="CyberFeeds">
</p>

## 📰 CyberFeeds {{VERSION}}: Release Notes

### 🚀 What's new in this release

<!-- Maintainer: Rewrite the marked paragraph for every release. Use 25-45 words, lead with user-facing changes, and do not repeat the app name or version. -->
<!-- changelog-summary:start -->
Desktop shortcuts now use collision-free single-modifier combinations, the system tray menu eliminates opening flicker with smooth suggestions scrolling, and unified reactive time-of-day greetings harmonize across the titlebar and welcome screen.
<!-- changelog-summary:end -->

> **New to CyberFeeds?** A local-first RSS and Atom reader designed for speed, privacy, and focused desktop reading.

---

### ✨ Key Features & Highlights

- ⌨️ **Streamlined Single-Modifier Shortcuts & Window Hotkeys**:
  - Replaced dual-modifier hotkeys with single-modifier equivalents to eliminate conflicts with third-party software: show/hide is now `Alt+S`, maximize/restore window is `Alt+M` (alongside `F11`), and in-article search is `Alt+F` (alongside `F3`).
  - Automatic database migration upgrades stored legacy shortcuts seamlessly on startup.

- 🪟 **Refined Desktop Experience & System Tray**:
  - Eliminated tray menu opening flicker by showing the window strictly after its dimensions are computed.
  - Fixed tray menu app suggestions scrolling so all apps in the list remain accessible.
  - Refreshed companion suite app icons across About and tray interfaces.

- 🌅 **Harmonized Reactive Greetings & Clean Welcome Lounge**:
  - Synchronized reactive time-of-day greetings across the TopBar ticker and Welcome Lounge so they always agree consistently.
  - Removed the problematic "Open first unread article" button to eliminate navigation jumps and improve layout clarity.
  - Unified sidebar article counter badges with the typography of the welcome card.

- 🛠️ **Diagnostics, Polling & Cleanup Improvements**:
  - Background polling prevents notification suppression on fetch failures and properly deduplicates dateless feeds.
  - Notification popups are now reliably sorted newest-first by receipt time.
  - Added a direct Settings navigation shortcut button inside the storage cleanup banner.
  - Updated update notification popups to adopt the standard glass-card tooltip component.

<details>
<summary><b>🌐 Ver notas de la versión en Español</b></summary>

### 🚀 Novedades de esta versión

Los atajos de teclado ahora utilizan combinaciones de un solo modificador sin conflictos, el menú de la bandeja del sistema elimina el parpadeo al abrir con desplazamiento fluido, y los saludos reactivos se sincronizan en toda la interfaz.

---

### ✨ Novedades destacadas

- ⌨️ **Atajos de un solo modificador y control de ventana optimizado**:
  - Se sustituyeron combinaciones de dos modificadores por atajos de un solo modificador para evitar conflictos con otras aplicaciones del sistema: mostrar/ocultar ahora es `Alt+S`, maximizar/restaurar ventana es `Alt+M` (junto con `F11`) y buscar en artículo es `Alt+F` (junto con `F3`).
  - Migración automática que actualiza atajos guardados al iniciar la aplicación.

- 🪟 **Bandeja del sistema y visualización refinada**:
  - Se eliminó el parpadeo de apertura del menú del tray mostrándolo únicamente tras calcular sus dimensiones exactas.
  - Se corrigió el desplazamiento del listado de sugerencias de la suite en el tray para mostrar todas las apps fluidamente.
  - Iconos actualizados de las apps de la suite en About y el tray.

- 🌅 **Saludos sincronizados y pantalla de bienvenida más limpia**:
  - Sincronización reactiva del saludo según la hora del día entre la barra superior y la pantalla de bienvenida.
  - Se retiró el botón de "Abrir primer artículo sin leer" para evitar saltos inesperados y estados inconsistentes.
  - Tipografía unificada entre los contadores de artículos de la barra lateral y la tarjeta de bienvenida.

- 🛠️ **Mejoras en sondeo, notificaciones y limpieza**:
  - El sondeo periódico previene la supresión de notificaciones en fallos temporales y deduplica feeds sin fechas.
  - Los popups de aviso se ordenan por orden de llegada más reciente.
  - Acceso directo a configuración de mantenimiento integrado en el banner de limpieza.
  - Los popups de actualización adoptan el estilo glass-card de los tooltips de la suite.

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
