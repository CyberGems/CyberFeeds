<p align="center">
  <img src="https://raw.githubusercontent.com/CyberGems/CyberFeeds/main/resources/icon.png" width="120" alt="CyberFeeds">
</p>

## 📰 CyberFeeds {{VERSION}}: Release Notes

### 🚀 What's new in this release

<!-- IMPORTANT FOR AGENTS & MAINTAINERS: Always rewrite this entire section and highlights with the ACTUAL release notes for this specific new version before tagging. NEVER leave or copy previous version notes! Use 25-45 words for the summary, lead with user-facing changes, and do not repeat the app name or version. Keep the Spanish mirror inside the details block in sync: translate the summary and rewrite the highlights. -->
<!-- changelog-summary:start -->
A first-run welcome wizard sets up language, theme and feeds in seconds. Scroll stability is rebuilt (no more duplicated or jumping articles), failed thumbnails show a clean placeholder, and the new-articles pill now applies everything in one go.
<!-- changelog-summary:end -->

> **New to CyberFeeds?** A local-first RSS and Atom reader designed for speed, privacy, and focused desktop reading.

---

### ✨ Key Features & Highlights

- 🧙 **Welcome Wizard**:
  - First launch with an empty library opens a three-step setup: language, theme with live preview, and your first feeds.
  - Add feeds from curated suggestions (CyberFeeds releases, Reddit, YouTube, BBC News, GitHub Blog), any URL, or an OPML import.
  - Skippable anytime with Esc; the wizard re-opens only for profiles that never completed it.

- 📜 **Rock-Solid Article List**:
  - Duplicated entries that overlapped rows and flickered the strip are gone: pagination is now deterministic and the infinite-scroll merge is deduplicated.
  - Failed thumbnails keep a fixed-height placeholder (muted image-off icon), ending the height swings while scrolling.
  - The new-articles pill consolidates each fetch wave into a single count and applies everything in one go; scrolling back to the top manually applies the pending articles in place.
  - The "more below" footer indicator is now a passive status line.

- 🛡️ **Self-Recovery & Logging**:
  - A black window after crashes or power cuts is handled automatically: the renderer reloads, first paint is watched, and recovery relaunches clear the GPU caches with a capped budget before showing a clear error.
  - Unclean shutdowns proactively clear the GPU caches on the next start.
  - Main-process activity now persists to a rotating logs/main.log, and uncaught renderer errors show a themed reload fallback.

- 🖱️ **Press-and-Hold Tab Scrolling**:
  - Holding the tab strip chevrons glides the tabs continuously; quick clicks keep the previous smooth jump.

- 📰 **Refreshed Feed Suggestions**:
  - BBC News (rich, image-bearing RSS) replaces Hacker News, and a single Reddit entry remains among the starter suggestions.

<details>
<summary><b>🇪🇸 Ver notas de la versión en Español</b></summary>

### 🚀 Novedades de esta versión

Un asistente de bienvenida configura idioma, tema y fuentes en segundos. La estabilidad del scroll queda reconstruida (sin artículos duplicados ni saltos), las miniaturas rotas muestran un marcador limpio y el pill de novedades aplica todo de una sola vez.

> **¿Nuevo en CyberFeeds?** Un lector de RSS y Atom local-first diseñado para la velocidad, la privacidad y una lectura de escritorio enfocada.

---

### ✨ Novedades destacadas

- 🧙 **Asistente de bienvenida**:
  - El primer arranque con la biblioteca vacía abre una configuración de tres pasos: idioma, tema con vista previa en vivo y tus primeras fuentes.
  - Añade feeds desde sugerencias curadas (lanzamientos de CyberFeeds, Reddit, YouTube, BBC News, Blog de GitHub), cualquier URL o una importación OPML.
  - Omitible en cualquier momento con Esc; el asistente solo reaparece en perfiles que no lo completaron.

- 📜 **Lista de artículos sólida**:
  - Los duplicados que solapaban filas y hacían parpadear la lista desaparecieron: la paginación ahora es determinista y el scroll infinito fusiona sin repetir.
  - Las miniaturas rotas conservan un contenedor de altura fija (icono discreto de imagen no disponible), acabando con los saltos de altura al scrollear.
  - El pill de novedades consolida cada tanda en una sola cifra y aplica todo de una vez; volver arriba manualmente aplica lo pendiente en el sitio.
  - El indicador "más abajo" del pie es ahora una línea de estado pasiva.

- 🛡️ **Autorrecuperación y registro**:
  - Una ventana en negro tras fallos o cortes de luz se maneja sola: el renderer se recarga, se vigila el primer pintado y las recauchutados de recuperación limpian las cachés de GPU con presupuesto acotado antes de avisar.
  - Los apagados sucios limpian preventivamente las cachés de GPU en el siguiente arranque.
  - La actividad del proceso principal persiste en logs/main.log rotativo, y los errores no capturados del renderer muestran un fallback con recarga.

- 🖱️ **Desplazamiento de pestañas manteniendo el click**:
  - Mantener pulsados los chevrons de la barra desliza las pestañas de forma continua; el click rápido conserva el salto anterior.

- 📰 **Sugerencias de feeds renovadas**:
  - BBC News (RSS completo con imágenes) sustituye a Hacker News, y queda una sola entrada de Reddit entre las sugerencias iniciales.

### ⚠️ Antes de instalar

- **Windows:** esta versión aún no está firmada digitalmente. SmartScreen puede avisar antes de ejecutarla: **Más información › Ejecutar de todas formas**. Cuando Smart App Control está activado, Windows rechaza programas sin firmar; consulta la [política de firma de código](https://github.com/CyberGems/.github/blob/main/CODE_SIGNING.md). Verifica la descarga con los checksums SHA256 que aparecen más abajo.

</details>

---

### ⚠️ Before you install

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

*Crafted with precision by [CyberGems](https://cybergems.org)*
