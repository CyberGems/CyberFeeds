# Privacidad — CyberFeeds

CyberFeeds funciona en tu PC y guarda tus datos en tu PC. **No tiene cuenta, telemetría, SDK de analítica ni anuncios.** Nunca envía tu suscripciones, artículos o estado de lectura a su autor ni a nadie más.

Todo lo que sabe (suscripciones, artículos o estado de lectura) se queda en `%APPDATA%\cybersfeeds.db`, la carpeta `logs\` y `backups\` (o la carpeta de copias que elijas). El instalador conserva los datos (`deleteAppDataOnUninstall: false`). Borra esas carpetas manualmente si quieres eliminarlos.

## Cuándo CyberFeeds se conecta a internet

Estas son todas las conexiones que CyberFeeds hace por su cuenta. Ninguna envía tu suscripciones, artículos o estado de lectura. Como en cualquier petición de internet, el servidor ve tu dirección IP.

| Cuándo | Dónde | Para qué | Cómo desactivarlo |
|---|---|---|---|
| Al iniciar y según la programación de sondeo | las URLs de los feeds que subscribiste | Obtener artículos nuevos y su contenido | `pollingEnabled`; cada feed también se puede desactivar por separado |
| Al iniciar, para feeds sin icono | `www.google.com/s2/favicons` | Obtener el icono del feed | Sin ajuste específico |
| Con la extracción de contenido completo activada | la web del artículo y `www.youtube.com/oembed` | Mostrar el artículo completo o la vista previa del vídeo | `autoFetchFullContent` (activado por defecto) |
| 8 segundos después de iniciar | GitHub Releases, con notas desde `api.github.com` | Consultar una versión nueva | `autoUpdate` |

La traducción usa `clients5.google.com` con `api.mymemory.translated.net` como alternativa. Las búsquedas web y la reproducción en YouTube abren sitios externos. Todo ocurre solo cuando tú lo inicias.

## Qué lee CyberFeeds de tu PC

CyberFeeds lee solo su base de datos local y los feeds que elegiste; no se recogen datos de uso. Esa información se queda en pantalla. Todo lo que cambia el sistema pide confirmación antes y, cuando es posible, guarda una copia para poder deshacerlo.

## Dudas

Abre un issue: https://github.com/CyberGems/CyberFeeds/issues

Para una pregunta concreta sobre privacidad, usa la [página de contacto](https://cybergems.org/contact). La declaración general de la suite está en [cybergems.org/es/privacy](https://cybergems.org/es/privacy).
