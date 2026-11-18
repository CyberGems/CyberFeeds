<p align="center">
  <img src="https://raw.githubusercontent.com/CyberGems/CyberFeeds/main/resources/icon.png" width="120" alt="CyberFeeds">
</p>

## 📰 CyberFeeds {{VERSION}}: Release Notes

### 🚀 What's new in this release

<!-- IMPORTANT FOR AGENTS & MAINTAINERS: Always rewrite this entire section and highlights with the ACTUAL release notes for this specific new version before tagging. NEVER leave or copy previous version notes! Use 25-45 words for the summary, lead with user-facing changes, and do not repeat the app name or version. Keep the Spanish mirror inside the details block in sync: translate the summary and rewrite the highlights. -->
<!-- changelog-summary:start -->
Fixes the system tray menu and notification popup failing to open in sandboxed Electron windows by removing an external preload dependency blocked under sandbox isolation, and triggers immediate tray measurement on reopen.
<!-- changelog-summary:end -->

> **New to CyberFeeds?** A local-first RSS and Atom reader designed for speed, privacy, and focused desktop reading.

---

### ✨ Key Features & Highlights

- 🪟 **Reliable sandboxed tray and notifications**: Removed the external `@electron-toolkit/preload` import from the preload bundle so sandboxed tray menu and toast notification windows load `window.api` cleanly on launch.
- ⚡ **Instant tray sizing on reopen**: Triggered an immediate size measurement when `tray:show` fires so reopening the tray menu renders at full dimensions right away instead of waiting for the fallback reveal timer.

<details>
<summary><b>🇪🇸 Ver notas de la versión en Español</b></summary>

### 🚀 Novedades de esta versión

Corrige el fallo que impedía abrir el menú de la bandeja y las notificaciones emergentes en ventanas con sandbox al eliminar una dependencia externa del preload bloqueada por el aislamiento, y dispara medición inmediata al reabrir la bandeja.

> **¿Nuevo en CyberFeeds?** Un lector de RSS y Atom local-first diseñado para la velocidad, la privacidad y una lectura de escritorio enfocada.

---

### ✨ Novedades destacadas

- 🪟 **Bandeja y notificaciones fiables en sandbox**: Se eliminó la importación externa `@electron-toolkit/preload` del preload compilado para que las ventanas sandboxeadas de la bandeja y las notificaciones carguen `window.api` correctamente desde el inicio.
- ⚡ **Medición inmediata al reabrir la bandeja**: Se dispara una medición de tamaño inmediata al recibir `tray:show` para mostrar el menú al instante en aperturas repetidas sin esperar el temporizador de respaldo.

### ℹ️ Antes de instalar

- **Windows:** esta versión aún no está firmada digitalmente. SmartScreen puede avisar antes de ejecutarla: **Más información › Ejecutar de todas formas**. Cuando Smart App Control está activado, Windows rechaza programas sin firmar; consulta la [política de firma de código](https://github.com/CyberGems/.github/blob/main/CODE_SIGNING.md). Verifica la descarga con los checksums SHA256 que aparecen más abajo.

</details>

---

### ℹ️ Before you install

- **Windows:** this release is not code-signed yet. SmartScreen may ask before it runs: **More info › Run anyway**. Where Smart App Control is on, Windows refuses unsigned programs; see the [code signing policy](https://github.com/CyberGems/.github/blob/main/CODE_SIGNING.md). Verify the download with the SHA256 checksums below.

---

### 📦 Downloads & Packages

> ⬇️ **Direct download:** click a file name to download it now. Same files as in **Assets** at the bottom of this page.

| File | Description | Platform |
| :--- | :--- | :--- |
| **[`CyberFeeds-{{RAW_VERSION}}-setup.exe`](https://github.com/CyberGems/CyberFeeds/releases/download/{{VERSION}}/CyberFeeds-{{RAW_VERSION}}-setup.exe)** | 🚀 **Recommended Installer** (NSIS Assisted Setup with Desktop & Start Menu options) | Windows 10 / 11 (x64) |
| **[`CyberFeeds-{{RAW_VERSION}}-portable.exe`](https://github.com/CyberGems/CyberFeeds/releases/download/{{VERSION}}/CyberFeeds-{{RAW_VERSION}}-portable.exe)** | 💼 **Portable Executable** (Zero install, self-contained data directory) | Windows 10 / 11 (x64) |

---

### 🔐 VirusTotal and SHA256

> 🛡️ The report opens on VirusTotal and does not download anything.

**Installer**: [View VirusTotal report](https://www.virustotal.com/gui/file/{{INSTALLER_HASH}})

```text
{{INSTALLER_HASH}}
```

**Portable**: [View VirusTotal report](https://www.virustotal.com/gui/file/{{PORTABLE_HASH}})

```text
{{PORTABLE_HASH}}
```

---

📜 **Full changelog:** browse every version in [CHANGELOG.md](https://github.com/CyberGems/CyberFeeds/blob/main/CHANGELOG.md).

*Crafted with precision by [CyberGems](https://cybergems.org)*
