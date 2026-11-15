<p align="center">
  <img src="https://raw.githubusercontent.com/CyberGems/CyberFeeds/main/resources/icon.png" width="120" alt="CyberFeeds">
</p>

## 📰 CyberFeeds {{VERSION}}: Release Notes

### 🚀 What's new in this release

<!-- IMPORTANT FOR AGENTS & MAINTAINERS: Always rewrite this entire section and highlights with the ACTUAL release notes for this specific new version before tagging. NEVER leave or copy previous version notes! Use 25-45 words for the summary, lead with user-facing changes, and do not repeat the app name or version. Keep the Spanish mirror inside the details block in sync: translate the summary and rewrite the highlights. -->
<!-- changelog-summary:start -->
Search notification history by title, source or content, and bring more thumbnails into article lists across Reddit and other feeds. Searches ignore accents and case, removed Reddit posts are filtered out, and refreshed controls make settings, tabs, menus and window closing feel clearer.
<!-- changelog-summary:end -->

> **New to CyberFeeds?** A local-first RSS and Atom reader designed for speed, privacy, and focused desktop reading.

---

### ✨ Key Features & Highlights

- 🔎 **Search That Finds It Again**:
  - Search notification history by article title, feed name, or content, with a result count and a clear no-results state.
  - Article searches and filters now match regardless of accents or letter case, and bulk actions stay in sync with the filtered results.
  - Focusing article search opens recent searches for quick selection.

- 🖼️ **More Reliable Article Thumbnails**:
  - Missing images can be recovered from public article metadata, including when the feed and article use different domains.
  - Reddit gallery and feed images provide more previews, and removed Reddit submissions no longer add noise to incoming items and notifications.
  - Saved thumbnail URLs are decoded before display, and legacy HTTP image links are upgraded to HTTPS.

- 🧭 **Clearer Navigation and Controls**:
  - Settings dropdowns use a consistent, theme-aware picker. The More menu only highlights its first item when opened for keyboard navigation.
  - Article tabs have more room and reveal clipped titles with a quick marquee on hover.
  - The close button has better contrast in the gray theme, closes with Alt+F4, and the close dialog's dismissal tooltip reads “Cancel”.
  - Opening an article clears its unread indicator immediately.

- ✂️ **Consistent Text Editing**:
  - Editable fields share a themed, bilingual context menu with undo, redo, cut, copy, paste, select all, and delete.

<details>
<summary><b>🇪🇸 Ver notas de la versión en Español</b></summary>

### 🚀 Novedades de esta versión

Busca el historial de notificaciones por título, fuente o contenido y recupera más miniaturas en listas de artículos de Reddit y otros feeds. Las búsquedas ignoran tildes y mayúsculas, se filtran publicaciones eliminadas de Reddit y los controles de configuración, pestañas, menús y cierre son más claros.

> **¿Nuevo en CyberFeeds?** Un lector de RSS y Atom local-first diseñado para la velocidad, la privacidad y una lectura de escritorio enfocada.

---

### ✨ Novedades destacadas

- 🔎 **Búsqueda para encontrarlo después**:
  - Busca en el historial de notificaciones por título del artículo, nombre del feed o contenido, con conteo y estado claro cuando no hay resultados.
  - Las búsquedas y filtros de artículos encuentran coincidencias sin importar tildes o mayúsculas, y las acciones en lote siguen sincronizadas con los resultados filtrados.
  - Al enfocar la búsqueda de artículos, se abre el historial reciente para elegir con rapidez.

- 🖼️ **Miniaturas más confiables**:
  - Las imágenes faltantes se recuperan desde los metadatos públicos del artículo, incluso si el feed y la noticia usan dominios distintos.
  - Las imágenes de galerías y feeds de Reddit aportan más vistas previas, y las publicaciones eliminadas por Reddit ya no generan ruido en los artículos y notificaciones entrantes.
  - Las URL guardadas de miniaturas se decodifican antes de mostrarse y los enlaces HTTP antiguos se actualizan a HTTPS.

- 🧭 **Controles y navegación más claros**:
  - Los desplegables de configuración usan un selector temático uniforme. El menú More solo resalta el primer elemento cuando se abre para navegar con el teclado.
  - Las pestañas de artículos tienen más espacio y muestran los títulos recortados con un efecto marquee rápido al pasar el cursor.
  - El botón de cierre tiene mejor contraste en el tema Gris, cierra con Alt+F4 y el tooltip para cerrar el diálogo dice «Cancel».
  - Al abrir un artículo, su indicador de no leído desaparece de inmediato.

- ✂️ **Edición de texto consistente**:
  - Los campos editables comparten un menú contextual bilingüe y temático con deshacer, rehacer, cortar, copiar, pegar, seleccionar todo y eliminar.

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

📜 **Full changelog:** browse every version in [CHANGELOG.md](https://github.com/CyberGems/CyberFeeds/blob/main/CHANGELOG.md).

*Crafted with precision by [CyberGems](https://cybergems.org)*
