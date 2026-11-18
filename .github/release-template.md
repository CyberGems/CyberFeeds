<p align="center">
  <img src="https://raw.githubusercontent.com/CyberGems/CyberFeeds/main/resources/icon.png" width="120" alt="CyberFeeds">
</p>

## 📰 CyberFeeds {{VERSION}}: Release Notes

### 🚀 What's new in this release

<!-- IMPORTANT FOR AGENTS & MAINTAINERS: Always rewrite this entire section and highlights with the ACTUAL release notes for this specific new version before tagging. NEVER leave or copy previous version notes! Use 25-45 words for the summary, lead with user-facing changes, and do not repeat the app name or version. Keep the Spanish mirror inside the details block in sync: translate the summary and rewrite the highlights. -->
<!-- changelog-summary:start -->
System tray submenus now open as side-by-side flyout panels matching dark, grayscale, and light themes. The tray and notifier windows gain sandbox isolation, web security, URL and path validation, and reliable main-window reveal if first paint never fires.
<!-- changelog-summary:end -->

> **New to CyberFeeds?** A local-first RSS and Atom reader designed for speed, privacy, and focused desktop reading.

---

### ✨ Key Features & Highlights

- 🪟 **Side-by-side tray flyout panels**: `Help` and `More from CyberGems` open beside the main tray card on hover or click, support Left/Right arrow navigation and `Escape`, adapt to every theme, and orient automatically to any screen edge.
- 🛡️ **Stronger window sandboxing**: Tray and notifier windows run sandboxed with web security, CSP headers, and navigation locks; external links and settings paths are checked; startup errors report clearly; and the main window shows reliably without stalling on first paint.

<details>
<summary><b>🇪🇸 Ver notas de la versión en Español</b></summary>

### 🚀 Novedades de esta versión

Los submenús de la bandeja ahora se abren como paneles flyout laterales adaptados a los temas oscuro, escala de grises y claro. Bandeja y notificaciones suman aislamiento sandbox, seguridad web, validación de enlaces y rutas, y apertura fiable de la ventana principal aunque falle el primer pintado.

> **¿Nuevo en CyberFeeds?** Un lector de RSS y Atom local-first diseñado para la velocidad, la privacidad y una lectura de escritorio enfocada.

---

### ✨ Novedades destacadas

- 🪟 **Paneles flyout laterales en la bandeja**: `Ayuda` y `Más de CyberGems` se abren junto a la tarjeta principal al pasar el cursor o hacer clic, admiten navegación con flechas y `Escape`, respetan los tres temas y se orientan según el borde del monitor.
- 🛡️ **Mayor aislamiento y fiabilidad**: Las ventanas de bandeja y avisos se ejecutan en sandbox con seguridad web, CSP y bloqueo de navegación; se validan URLs y rutas de ajustes; los errores de arranque se muestran al usuario y la ventana principal se revela aunque falte el evento inicial de pintado.

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
