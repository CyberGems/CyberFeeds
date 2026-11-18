# Changelog

All notable changes to CyberFeeds are documented here.

## [1.32.2] - 2026-11-18

### 🇺🇸 English

- Convert the tray submenus (`Help` and `More from CyberGems`) into side-by-side flyout panels with dwell hover, click toggling, keyboard arrow navigation, dark/grayscale/light theme styling, and automatic monitor-edge placement.
- Sandbox the tray and notifier windows with web security, content security policies, and navigation locking, validate external URLs and saved settings paths, clamp snooze durations, and report startup failures cleanly.
- Reveal the main window reliably even if its initial first-paint event never lands.

### 🇪🇸 Español

- Convierte los submenús de la bandeja (`Ayuda` y `Más de CyberGems`) en paneles flyout laterales con retardo al pasar el cursor, alternancia por clic, navegación con flechas del teclado, adaptación a los tres temas y colocación automática según los bordes del monitor.
- Aísla en sandbox las ventanas de bandeja y notificaciones con seguridad web, política CSP y bloqueo de navegación, valida URLs externas y rutas guardadas en ajustes, acota los tiempos de aplazamiento e informa fallos de arranque con claridad.
- Muestra la ventana principal de forma fiable incluso si no llega su evento inicial de primer pintado.

## [1.32.1] - 2026-11-16

### 🇺🇸 English

- Ship winget manifests with every release and automate Windows Package Manager submissions.

### 🇪🇸 Español

- Publica manifiestos winget con cada release y automatiza los envíos al Windows Package Manager.

## [1.32.0] - 2026-11-15

### 🇺🇸 English

- Notifications now follow the selected dark, grayscale, or light theme, and their transparent surface recovers after the PC wakes from sleep. The cleanup banner also adapts to the active theme.
- A titlebar update indicator opens the updater when a new version is available.
- The open-tabs menu now matches the selected theme. Mouse-wheel scrolling is smooth, and tab hover marquees and tooltips stay stable while the list moves.
- Settings now use consistent introductory helpers across all sections, calmer icon and selection colors, and an animated saved-state divider. Global shortcut scope is disabled until an action has a shortcut.
- The installer sidebar now follows the suite's shared style and features the app icon.

### 🇪🇸 Español

- Las notificaciones ahora siguen el tema oscuro, Gris o Claro, y su fondo transparente se recupera al volver de la suspensión del PC. El banner de limpieza también se adapta al tema activo.
- Un indicador en la barra superior abre el actualizador cuando hay una nueva versión disponible.
- El menú de pestañas abiertas ahora sigue el tema elegido. La rueda desplaza la lista suavemente y los marquee y tooltips permanecen estables mientras se mueve.
- La configuración ahora usa ayudas introductorias uniformes, colores más sobrios para iconos y selección, y un separador animado para el estado guardado. El ámbito global de un atajo se desactiva hasta que la acción tenga una combinación asignada.
- La barra lateral del instalador ahora sigue el estilo común de la suite e incluye el icono destacado de la app.

## [1.31.0] - 2026-11-14

### 🇺🇸 English

- Notification history now has its own search across article titles, feed names, and content, with a result count and a clear empty state.
- Search and filter matching now ignores accents and letter case, and bulk actions stay aligned with the filtered article results.
- Removed Reddit submissions are filtered from incoming feed items and notifications. Reddit gallery and feed images now fill more missing thumbnails; saved image URLs are decoded before rendering.
- Article lists can recover missing thumbnails from public article metadata, including feeds hosted on a different domain from the linked story. Legacy HTTP image links are upgraded to HTTPS.
- Opening an article clears its unread indicator immediately. Focusing article search opens recent searches for quick selection.
- Settings dropdowns use the app's themed picker style. The More menu no longer highlights its first item on mouse open, while keyboard opening keeps keyboard navigation ready.
- Article tabs have more room and reveal clipped titles with a quick hover marquee.
- The close button has better contrast in the gray theme, uses Alt+F4, and the close dialog's dismissal tooltip says “Cancel”.
- Editable fields share a themed, bilingual context menu with undo, redo, cut, copy, paste, select all, and delete.

### 🇪🇸 Español

- El historial de notificaciones ahora tiene su propio buscador por título, nombre del feed y contenido, con conteo de resultados y un estado vacío claro.
- Las búsquedas y los filtros ignoran tildes y mayúsculas, y las acciones en lote se mantienen sincronizadas con los artículos filtrados.
- Las publicaciones eliminadas por Reddit se filtran de los nuevos artículos y notificaciones. Las imágenes de galerías y feeds de Reddit completan más miniaturas; las URL guardadas se decodifican antes de mostrarse.
- Las listas pueden recuperar miniaturas faltantes desde los metadatos públicos del artículo, incluso si el feed y la noticia usan dominios distintos. Los enlaces de imagen HTTP antiguos se actualizan a HTTPS.
- Al abrir un artículo, su indicador de no leído desaparece de inmediato. Al enfocar la búsqueda de artículos, se abre el historial reciente para elegir con rapidez.
- Los desplegables de configuración usan el estilo temático de la app. El menú More ya no resalta su primer elemento al abrirse con el ratón, pero conserva la navegación por teclado al abrirse con atajo.
- Las pestañas de artículos tienen más espacio y muestran títulos recortados con un efecto marquee rápido al pasar el cursor.
- El botón de cierre tiene mejor contraste en el tema Gris, usa Alt+F4 y el tooltip para cerrar el diálogo dice «Cancel».
- Los campos editables comparten un menú contextual bilingüe y temático con deshacer, rehacer, cortar, copiar, pegar, seleccionar todo y eliminar.

## [1.30.0] - 2026-11-03

### 🇺🇸 English

- First-run welcome wizard: when the library is empty and the profile never completed it, a full-window setup opens with step 1 picking language and theme with live preview, step 2 adding the first feeds (suggestions shared with the Add Feed modal, a custom URL, or OPML import), and step 3 summarizing and pointing to keyboard basics; skippable with Esc.
- Self-recovery for renderer/GPU failures: the main process reloads the renderer on crash, watches the first paint and reloads or relaunches with GPU caches cleared when the window stays black; relaunches are capped and end in an error dialog, and unclean shutdowns (power cuts) clear the GPU caches proactively on the next start.
- Persistent main-process logging: console output mirrors to `logs/main.log` (rotating, with `uncaughtException`/`unhandledRejection` records).
- React ErrorBoundary with a themed reload fallback for uncaught renderer errors.
- Press-and-hold on the tab strip navigation buttons glides the strip continuously; a quick click keeps the previous jump.
- Duplicated articles no longer corrupt the virtual list with overlapping rows and flicker: pagination breaks pubDate ties by id and the infinite-scroll page merge filters by id, so concurrent refreshes can no longer inject duplicate entries.
- Failed article thumbnails render a muted image-off placeholder inside the fixed-height container, ending the collapse of their 100px container after measurement on every remount that swung the list height by over a thousand pixels while scrolling.
- The new-articles pill now consolidates each fetch wave into a single check (trailing debounce) and applying loads the full pending count, instead of fragmenting into several consecutive pills and moving the list by a fraction of the announced count; scrolling back to the top manually applies the pending articles in place.
- The "more below" footer indicator read as a clickable button; it is now a passive, slightly larger status line.
- Add-feed suggestions updated: BBC News replaces Hacker News (its bare RSS made a poor first impression) and a single Reddit entry remains; the welcome wizard preview entry point (Settings > General) is now development-only, with production showing just the real first-run flow.

### 🇪🇸 Español

- Asistente de bienvenida de primer arranque: con la biblioteca vacía y un perfil que nunca lo completó, se abre una configuración a pantalla completa donde el paso 1 elige idioma y tema con vista previa en vivo, el paso 2 añade las primeras fuentes (sugerencias compartidas con el modal de Añadir feed, una URL personalizada o importación OPML) y el paso 3 resume y señala lo básico del teclado; omitible con Esc.
- Autorrecuperación ante fallos de renderer/GPU: el proceso principal recarga el renderer tras un crash, vigila el primer pintado y recarga o relanza limpiando las cachés de GPU si la ventana sigue en negro; los relanzamientos son acotados y terminan en un diálogo de error, y los apagados sucios (cortes de luz) limpian preventivamente las cachés de GPU en el siguiente arranque.
- Registro persistente del proceso principal: la salida de consola se refleja en `logs/main.log` (rotativo, con registros de `uncaughtException`/`unhandledRejection`).
- React ErrorBoundary con un fallback temático de recarga para errores no capturados del renderer.
- Mantener pulsados los botones de navegación de la barra de pestañas desliza la tira de forma continua; un clic rápido conserva el salto anterior.
- Los artículos duplicados ya no corrompen la lista virtual con filas solapadas y parpadeo: la paginación desempata por id las pubDate iguales y la fusión de páginas del scroll infinito filtra por id, así que los refrescos concurrentes ya no inyectan entradas duplicadas.
- Las miniaturas rotas muestran un marcador discreto de imagen no disponible dentro del contenedor de altura fija, acabando con el colapso de su contenedor de 100px tras cada medición que hacía oscilar la altura de la lista más de mil píxeles al scrollear.
- El pill de novedades consolida ahora cada tanda en una sola comprobación (debounce final) y aplicar carga el conteo completo pendiente, en lugar de fragmentarse en varios pills consecutivos y mover la lista solo una fracción de lo anunciado; volver arriba manualmente aplica los artículos pendientes en el sitio.
- El indicador "más abajo" del pie parecía un botón clicable; ahora es una línea de estado pasiva y algo más grande.
- Sugerencias de feeds renovadas: BBC News sustituye a Hacker News (su RSS pelado daba mala primera impresión) y queda una sola entrada de Reddit; el acceso de vista previa del asistente (Ajustes > General) pasa a ser solo de desarrollo, con producción mostrando únicamente el flujo real de primer arranque.

## [1.29.0] - 2026-10-29

### 🇺🇸 English

- Settings search: a filter-as-you-type bar in the tab column, auto-focused when the modal opens. Matches are highlighted (CSS Custom Highlight API) with an n/m counter and Enter/Shift+Enter navigation; cards and tabs without matches hide while searching, other tabs containing the query appear as jump chips, Ctrl+F refocuses the bar and Escape clears it before closing the modal.
- Notification "View" button and card clicks intermittently opened the main window without navigating to the article: the event was routed by exclusion from the window list and could land on the tray menu window; the main window is now addressed by reference.
- Tray menu first-open mispositioning on monitors whose scale differs from the primary is fixed: the tray icon rect arrived scaled by the wrong display factor and the window geometry was not re-stamped after display-scale crossings; the menu now anchors to the cursor when the rect is unusable and re-stamps after the new DPI context attaches.
- Notification popup auto-hide now respects interaction: the countdown stays paused until the cursor verifiably leaves the popup area.
- Text blur on notification card hover removed (the hover translateY re-rasterized text at subpixel offsets on scaled displays).
- Default show/hide hotkey is now Alt+Shift+R, following the suite Alt+Shift+X pattern and always global; saved legacy Alt+S / Alt+Shift+S values migrate automatically and the settings UI no longer offers an app-scoped toggle for it.
- Tray tooltip standardized to the suite middle-dot format with the global show/hide shortcut, plus a "Refreshing feeds..." status while fetching.
- Upgraded Electron 34.3.0 to 42.11.10 (Chromium 148, Node 24) with better-sqlite3 v13 and @electron/rebuild v4.
- The auto-start card inside General is now titled "System & Startup" instead of reusing the tab name.

### 🇪🇸 Español

- Buscador de ajustes: barra de filtro al escribir en la columna de pestañas, enfocada al abrir el modal. Las coincidencias se resaltan (CSS Custom Highlight API) con contador n/m y navegación con Enter/Shift+Enter; las tarjetas y pestañas sin coincidencias se ocultan mientras buscas, las otras pestañas con la consulta aparecen como chips de salto, Ctrl+F re-enfoca la barra y Escape la limpia antes de cerrar el modal.
- El botón "Ver" de las notificaciones y los clics en tarjetas a veces abrían la ventana principal sin navegar al artículo: el evento se enrutaba por exclusión de la lista de ventanas y podía caer en la ventana del menú del tray; la ventana principal ahora se dirige por referencia.
- Corregida la mala posición del menú del tray en su primera apertura en monitores con escala distinta a la del primario: el rect del icono llegaba escalado por el factor de pantalla equivocado y la geometría no se re-estampaba tras cruzar cambios de escala; el menú ahora se ancla al cursor cuando el rect no sirve y se re-estampa tras montar el nuevo contexto de DPI.
- El auto-ocultado del popup de notificaciones respeta ahora la interacción: la cuenta regresiva sigue en pausa hasta que el cursor sale de forma verificable del área del popup.
- Eliminado el texto borroso al pasar el cursor sobre las tarjetas de notificación (el translateY del hover re-rasterizaba el texto en desplazamientos subpíxel en pantallas escaladas).
- El atajo por defecto de mostrar/ocultar es ahora Alt+Shift+R, siguiendo el patrón Alt+Shift+X de la suite y siempre global; los valores previos Alt+S / Alt+Shift+S migran automáticamente y la interfaz de ajustes ya no ofrece un interruptor de ámbito de app para él.
- El tooltip del tray se estandariza al formato de punto medio de la suite con el atajo global de mostrar/ocultar, más un estado "Actualizando feeds..." durante la obtención.
- Electron actualizado de 34.3.0 a 42.11.10 (Chromium 148, Node 24) con better-sqlite3 v13 y @electron/rebuild v4.
- La tarjeta de auto-arranque dentro de General se titula ahora "Sistema e inicio" en lugar de reutilizar el nombre de la pestaña.

## [1.28.0] - 2026-10-24

### 🇺🇸 English

- Notification popups gain smooth top scroll fade overlays eliminating harsh clipping beneath the header buttons, with top and bottom fades aligned precisely to the cards area so the scrollbar track, thumb, and chevrons stay completely uncovered and interactive.
- Re-engineered custom scrollbar styling with balanced idle opacity, brightened hover/active states, and larger, clickable chevron buttons styled as rounded semitransparent buttons on hover.
- Auto-dismiss countdown timer updated: numbers display in clear alert red while actively ticking down and smoothly pulse with a breathing zoom in/out effect when held or paused on hover.
- Featured images in articles now render with natural aspect proportions without forced letterboxing or distortion.

### 🇪🇸 Español

- Los avisos de notificación incorporan degradados suaves de desplazamiento superior que eliminan el corte abrupto bajo los botones de la cabecera, con los degradados superior e inferior alineados exactamente al área de tarjetas para que el carril, el cabezal y los chevrones de la barra de scroll queden despejados y accesibles.
- Estilos de scrollbar personalizados rehechos con opacidad equilibrada en reposo, realce al interactuar y chevrones más grandes que se iluminan como botones semitransparentes en hover.
- Temporizador de cierre automático mejorado: los números se muestran en rojo de alerta durante el conteo activo y adoptan un efecto de respiración (zoom in/out) cuando está retenido o en pausa por interacción.
- Las imágenes destacadas de los artículos se muestran ahora con proporciones naturales, sin letterboxing forzado ni distorsión.

## [1.27.0] - 2026-10-24

### 🇺🇸 English

- Single-modifier shortcuts replace dual-modifier hotkeys to eliminate conflicts with third-party software: show/hide is now Alt+S, maximize/restore window is Alt+M (alongside F11), and in-article search is Alt+F (alongside F3); stored legacy shortcuts migrate automatically on startup.
- Tray menu opening flicker eliminated by showing the window strictly after its dimensions are computed, and app suggestions scrolling fixed so all apps in the list remain accessible.
- Companion suite app icons refreshed across About and tray interfaces.
- Reactive time-of-day greetings are synchronized across the TopBar ticker and Welcome Lounge so they always agree consistently.
- Removed the "Open first unread article" button to eliminate navigation jumps and improve layout clarity, and unified sidebar article counter badges with the typography of the welcome card.
- Background polling prevents notification suppression on fetch failures and properly deduplicates dateless feeds; notification popups are now reliably sorted newest-first by receipt time.
- Added a direct Settings navigation shortcut button inside the storage cleanup banner, and update notification popups adopt the standard glass-card tooltip component.

### 🇪🇸 Español

- Atajos de un solo modificador sustituyen a las combinaciones de dos modificadores para evitar conflictos con otras aplicaciones del sistema: mostrar/ocultar ahora es Alt+S, maximizar/restaurar ventana es Alt+M (junto con F11) y buscar en artículo es Alt+F (junto con F3); los atajos guardados migran automáticamente al iniciar la aplicación.
- Parpadeo de apertura del menú del tray eliminado mostrándolo únicamente tras calcular sus dimensiones exactas, y desplazamiento del listado de sugerencias corregido para que todas las apps sigan siendo accesibles.
- Iconos actualizados de las apps de la suite en About y el tray.
- Los saludos reactivos según la hora del día se sincronizan entre la barra superior y la pantalla de bienvenida para que siempre coincidan.
- Se retiró el botón de "Abrir primer artículo sin leer" para evitar saltos inesperados y mejorar la claridad del diseño, y la tipografía de los contadores de artículos de la barra lateral se unifica con la de la tarjeta de bienvenida.
- El sondeo periódico previene la supresión de notificaciones en fallos temporales y deduplica feeds sin fechas; los popups de aviso se ordenan de forma fiable por llegada más reciente.
- Acceso directo a Ajustes integrado en el banner de limpieza de almacenamiento, y los popups de actualización adoptan el componente glass-card estándar de la suite.

## [1.26.0] - 2026-10-22

### 🇺🇸 English

- New preference in Settings to toggle opening articles in independent tabs or reading them directly in-place; it automatically disables startup tab session options when tab mode is turned off and clears lingering tabs.
- Removed the standalone "Close all tabs" button next to the tab counter to eliminate misclicks with the window close button, and context menu tab actions adapt cleanly to your tab mode preference.
- Dedicated receipt time tracking (receivedAt) distinct from article publication time (createdAt) ensures unread badges and history sorting remain accurate even for backfilled feeds.
- Background polling cross-checks article publication dates against feed fetch baselines, preventing auto-cleanup rediscovery cycles from triggering burst notifications for week-old articles.

### 🇪🇸 Español

- Nueva opción en Ajustes para abrir artículos en pestañas independientes o verlos directamente en el lector; desactiva automáticamente el ajuste de sesión de pestañas al inicio cuando el modo pestañas se apaga y limpia las pestañas activas restantes.
- Se retiró el botón suelto de "Cerrar todas las pestañas" junto al contador para evitar clics accidentales con la X de la ventana, y las acciones de pestañas del menú contextual se adaptan limpiamente a tu preferencia de modo.
- Registro de hora de recepción (receivedAt) separado de la fecha de publicación del artículo (createdAt), manteniendo exacto el contador no visto y el orden del historial incluso con feeds que entregan artículos atrasados.
- El sondeo periódico cruza las fechas de publicación con las bases de obtención de cada feed, evitando que los ciclos de re-descubrimiento tras limpiezas automáticas disparen ráfagas de notificaciones por artículos de hace días.

## [1.25.0] - 2026-10-21

### 🇺🇸 English

- Granular storage cleanup and maintenance: choose specific cleanup targets including read articles older than a custom threshold, orphaned image thumbnails, and SQLite database compaction (VACUUM), keeping local storage lean without affecting bookmarked or favorited articles.
- Real-time reactive feedback banner during operations with clear byte reclaim summaries.
- Tray quick panel geometry redesigned cursor-aware to prevent positioning errors on vertical taskbars and secondary monitors, with window flicker eliminated during tray open actions.
- Optical alignment refinement on header greeting icons and typography.

### 🇪🇸 Español

- Limpieza granular de almacenamiento y mantenimiento: selecciona objetivos específicos como artículos leídos antiguos según un umbral personalizado, miniaturas huérfanas y compactación de SQLite (VACUUM), manteniendo el almacenamiento ligero sin tocar artículos marcados o favoritos.
- Banner con retroalimentación en tiempo real durante las operaciones y resúmenes claros del espacio recuperado en bytes.
- Geometría del panel rápido de la bandeja rediseñada en función del cursor para evitar errores de posición en barras de tareas verticales y monitores secundarios, con el parpadeo de la ventana eliminado al abrir el tray.
- Ajustes de alineación óptica en el icono de bienvenida de la barra superior y su tipografía.

## [1.24.0] - 2026-10-21

### 🇺🇸 English

- System tray context menu redesigned as a sleek glassmorphism quick panel card aligned with CyberGems suite standards, displaying real-time window visibility status (Visible, Minimized, or Hidden) with an instant toggle action.
- Interactive brand logo with micro-zoom animation and refined theme accents across action buttons.
- Article cards in the main feed list now display distinct video badges for posts with embedded YouTube, Vimeo, or web videos.
- Video filter queries now utilize an indexed database column (hasVideo), executing in under 1 ms and eliminating UI lag over large libraries.
- Embedded player links reliably open in your preferred browser configured in Settings.
- Notification popups maintain scroll stability across incoming batches without disruptive position resets, and a direct in-toast feed mute action silences high-frequency feeds and decrements unread counters seamlessly.

### 🇪🇸 Español

- El menú contextual de la bandeja se rediseña como una tarjeta flotante de estilo cristal alineada a los estándares de la suite CyberGems, mostrando el estado de la ventana en tiempo real (Visible, Minimizada u Oculta) con alternancia instantánea.
- Logotipo interactivo con microanimación de zoom al pasar el cursor y colores de acento refinados en los botones de acción.
- Las tarjetas de artículos de la lista principal muestran una insignia distintiva de video en publicaciones con contenido incrustado de YouTube, Vimeo o web.
- El filtro de videos utiliza ahora una columna indexada (hasVideo), ejecutándose en menos de 1 ms y eliminando cualquier retraso en bibliotecas masivas.
- Los enlaces a reproductores externos respetan fielmente el navegador web seleccionado en Configuración.
- Las notificaciones emergentes preservan la posición de desplazamiento entre lotes sin reinicios abruptos, y una acción rápida para silenciar feeds desde la propia notificación acalla feeds ruidosos y actualiza los contadores al instante.

## [1.23.0] - 2026-10-20

### 🇺🇸 English

- Titlebar cycles through dynamic status information (time-of-day greeting with coffee/sun/moon icons, unread counter, sync status, active feeds, and localized date) at a relaxed 16-second cadence, with interactive pause-on-hover and click-to-cycle navigation.
- Personalization options in General settings allow customizing your display name, clearing it for pure greetings (e.g. "Good morning"), or using the default user title.
- All articles discovered during a polling scan cycle are grouped and delivered in a single notification batch instead of individual fragmented popups, prioritized by publication date so the freshest content appears at the top; scrolling through the popup protects it from auto-dismissing.
- Theme selection streamlined to three core palettes: CyberFeeds (Dark), Grayscale (pure distraction-free monochrome), and Light.
- Toggles across Settings, About, and dialogs modernized to the tactile CyberNotes pill-switch style with checkmarks and theme-reactive accents.
- "Show suite recommendations" moved to the bottom of the Appearance tab, keeping General settings focused, and the tray context menu upgraded with the official CyberGems diamond icon for suite navigation.
- Pausing and resuming polling no longer flickers or resets your reading position in the article list, and window position and monitor placement reliably restore on multi-monitor setups across system restarts.

### 🇪🇸 Español

- La barra de título rota estados informativos dinámicos (saludo según la hora con iconos de café/sol/luna, artículos sin leer, sincronización, feeds activos y fecha localizada) con un ritmo relajado de 16 segundos, con pausa interactiva al pasar el cursor y cambio inmediato al hacer clic.
- Ajustes de personalización en General para configurar tu nombre, dejarlo vacío para saludos puros («Buenos días») o usar el título de usuario por defecto.
- Todos los artículos encontrados en una tanda de escaneo se entregan agrupados en una sola notificación en lugar de ventanas fragmentadas consecutivas, ordenados por fecha de publicación para que lo más reciente aparezca arriba; desplazarte por el popup evita su cierre automático.
- Selección de temas simplificada a 3 paletas esenciales: CyberFeeds (Oscuro), Gris (escala de grises sin distracciones) y Claro.
- Todos los interruptores de Ajustes, About y diálogos adoptan el estilo píldora táctil de CyberNotes con checkmark y acentos de color acordes al tema.
- «Mostrar recomendaciones de la suite» se trasladó al final de la pestaña Apariencia para dejar General enfocado, y el menú de la bandeja incorpora el diamante oficial de CyberGems para navegar la suite.
- Pausar y reanudar la sincronización ya no parpadea ni recarga tu posición de lectura en la lista de artículos, y la posición de la ventana y el monitor se restauran fielmente en configuraciones multimonitor tras reiniciar el sistema.

## [1.22.0] - 2026-10-16

### 🇺🇸 English

- Article tabs open in background or foreground with persistent session restore, an interactive tab counter button with a dropdown menu to switch or manage open tabs, and smooth chevron navigation buttons across tab strips and application columns without layout shift.
- Settings automatically discovers installed desktop browsers (Chrome, Edge, Firefox, Brave, Opera, Vivaldi) to open external links directly in your preferred browser, or you can browse for custom executables.
- NSIS installer gains a custom themed side banner and branded header matching the suite design.
- Tactile micro-animations and visual haptic feedback on interactive buttons, and the light theme is calibrated with warm palette tones and high-contrast logos.
- Empty reader state upgraded with informative status cards and feed error diagnostics.
- Window close confirmation dialog lets you choose between minimizing to tray or quitting, and the About modal is refreshed with suite-aligned layout, borderless icon badges, and system diagnostics.
- Clearer notification display modes with descriptive guidance and automatic limits.

### 🇪🇸 Español

- Las pestañas de artículos se abren en segundo o primer plano con persistencia de sesión, un botón contador interactivo con menú desplegable para cambiar o gestionar pestañas abiertas, y navegación fluida por botones de flecha en tiras de pestañas y columnas sin saltos de diseño.
- La configuración detecta automáticamente los navegadores instalados (Chrome, Edge, Firefox, Brave, Opera, Vivaldi) para abrir enlaces externos en tu navegador preferido, o puedes buscar un ejecutable personalizado.
- El instalador NSIS adopta un banner lateral temático y cabecera personalizada alineados con la suite.
- Microanimaciones táctiles y respuesta háptica visual en botones interactivos, y el tema claro queda calibrado con paleta cálida y logos de alto contraste.
- El panel de lectura vacío mejora con tarjetas de estado informativas y diagnósticos de errores de feed.
- Diálogo de confirmación al cerrar para elegir entre minimizar a la bandeja o salir, y el modal Acerca de renovado con diseño alineado a la suite, insignias sin bordes y diagnósticos del sistema.
- Modos de visualización de notificaciones más claros con guías explicativas y límites automáticos.

## [1.21.1] - 2026-09-19

### 🇺🇸 English

- The article pane and welcome cards now use the available width correctly across different display scales, stacking cleanly in narrow reader panes without stretching on wide layouts.
- Interface scale is adjustable from the welcome panel while retaining separate controls in Settings, and reader scale changes now provide a meaningful live preview.
- Notification delivery is bounded to protect the system when a large feed library resumes after downtime, and update notices render release notes safely with clearer, more accessible actions.
- Refined system tray menu: unified high-DPI tray icons, cleaner CyberGems shortcuts, localized menu labels, improved icon proportions, and a simplified one-line app list.
- About panel polish: removed redundant diagnostics help text and eliminated unnecessary scrolling at the default size.

### 🇪🇸 Español

- El panel de artículos y las tarjetas de bienvenida aprovechan ahora correctamente el ancho disponible en distintas escalas de pantalla, apilándose limpiamente en paneles estrechos sin estirarse en diseños anchos.
- La escala de la interfaz se ajusta desde el panel de bienvenida manteniendo los controles separados en Ajustes, y los cambios de escala del lector ofrecen una vista previa en vivo realmente útil.
- La entrega de notificaciones se acota para proteger el sistema cuando una biblioteca grande se reanuda tras tiempo caída, y los avisos de actualización muestran las notas de forma segura con acciones más claras y accesibles.
- Menú de la bandeja refinado: iconos de bandeja unificados en alta densidad, accesos de CyberGems más limpios, etiquetas localizadas, proporciones de iconos mejoradas y lista de apps simplificada en una línea.
- Pulido del panel Acerca de: se retiró el texto de ayuda redundante de diagnóstico y el scroll innecesario en el tamaño por defecto.

## [1.21.0] - 2026-09-19

### 🇺🇸 English

- Global Ctrl+F focuses the article search bar from anywhere in the application, with instant and Enter-to-search modes, multi-token matching, live results, and recent search history; reader text search retains match navigation and highlighting without interrupting active media.
- Picture-in-Picture video player: continue watching supported videos in a floating desktop window while browsing the feed.
- Improved YouTube, JW Player, and embedded video extraction with more accurate provider detection and reduced false positives from polls, comment boxes, social widgets, and other non-video iframes.
- Automated backup and restore: schedule automatic backups for feeds, folders, starred articles, and settings; configure the backup folder and retention limit, restore a selected backup, or remove old backups.
- Reader and context menu refinements: native icons and consistent actions for copying links, titles, images, and searching selected text; active media is preserved during article updates and lazy-loaded iframe handling improved.
- Search, video playback, backup management, and keyboard shortcut settings are available in English and Spanish.

### 🇪🇸 Español

- Ctrl+F global enfoca el buscador de artículos desde cualquier parte de la aplicación, con modos instantáneo y por Enter, coincidencias de varios términos, resultados en vivo e historial de búsquedas recientes; la búsqueda de texto del lector conserva la navegación y el resaltado sin interrumpir los medios en reproducción.
- Reproductor de video en Picture-in-Picture: sigue viendo los videos compatibles en una ventana flotante de escritorio mientras navegas por el feed.
- Mejor extracción de videos de YouTube, JW Player e incrustados, con detección de proveedores más precisa y menos falsos positivos de encuestas, cajas de comentarios, widgets sociales y otros iframes sin video.
- Copia de seguridad y restauración automáticas: programa respaldos automáticos de feeds, carpetas, artículos destacados y ajustes; configura la carpeta de respaldo y el límite de retención, restaura una copia seleccionada o elimina las antiguas.
- Refinamientos del lector y el menú contextual: iconos nativos y acciones consistentes para copiar enlaces, títulos e imágenes, y para buscar el texto seleccionado; los medios activos se conservan al actualizar artículos y el manejo de iframes diferidos mejora.
- La búsqueda, la reproducción de video, la gestión de copias de seguridad y los ajustes de atajos de teclado están disponibles en inglés y español.

## [1.20.0] - 2026-09-17

### 🇺🇸 English

- Fast in-article text search accessible via Ctrl+F or the dedicated reader toolbar button, with non-destructive text marking that never interrupts or reloads active media.
- Live match counter, Next/Previous navigation (Enter/Shift+Enter), smooth centering into view, and Escape to close.
- Isolated reader body rendering eliminates DOM resets during search navigation; the feature is fully bilingual (English and Spanish).
- Sticky header bar: a full-width reader header smoothly slides down below the toolbar when scrolling past the main article title, displaying the source feed icon and article title with native tooltip metadata and a quick "Back to top" action, and hides when returning to the top of the article.
- Refined video filter and detection accuracy: false-positive classifications from generic non-video iframes (polls, comment boxes, WordPress embed cards, social widgets) are eliminated, with targeted SQL filtering for verified video providers (YouTube, Vimeo, Rumble, Dailymotion, JW Player, Facebook Video, TikTok, Twitch, BitChute, Streamable, Odysee, and native video elements).
- Media player reliability and playback stability: protocol-relative // embed normalization to https, YouTube player parameters and sandbox policy enhancements, and background article scraping no longer tears down active media playback.

### 🇪🇸 Español

- Búsqueda rápida de texto dentro del artículo accesible vía Ctrl+F o el botón dedicado de la barra del lector, con marcado de texto no destructivo que nunca interrumpe ni recarga los medios activos.
- Contador de coincidencias en vivo, navegación Siguiente/Anterior (Enter/Shift+Enter), centrado suave en pantalla y Escape para cerrar.
- El cuerpo del lector se renderiza aislado para eliminar reinicios del DOM durante la navegación de búsqueda; la función es completamente bilingüe (inglés y español).
- Barra superior fija: una cabecera de lectura a todo ancho se desliza suavemente bajo la barra de herramientas al pasar el título principal del artículo, mostrando el icono del feed de origen y el título con metadatos en el tooltip nativo y una acción rápida de "volver arriba", y se oculta al volver al inicio del artículo.
- Filtro y detección de videos refinados: se eliminan las clasificaciones falsas positivas de iframes genéricos sin video (encuestas, cajas de comentarios, tarjetas incrustadas de WordPress, widgets sociales), con filtrado SQL dirigido a proveedores verificados (YouTube, Vimeo, Rumble, Dailymotion, JW Player, Facebook Video, TikTok, Twitch, BitChute, Streamable, Odysee y elementos video nativos).
- Fiabilidad del reproductor y estabilidad de reproducción: normalización a https de embeds con // protocolo-relativo, parámetros del reproductor de YouTube y política de sandbox mejorados, y el scraping de artículos en segundo plano ya no corta la reproducción activa.

## [1.19.1] - 2026-09-16

### 🇺🇸 English

- Fixed severe UI freezes and high CPU/memory consumption when loading large notification histories (1,000+ items): progressive batch rendering (50 to 80 items per slice) via IntersectionObserver delivers smooth scrolling across Notification History and Inbox panels, notification card components are memoized to stop cascading re-renders, and incoming feed notifications use 500ms batched event throttling to keep high framerates during intensive polling.
- Fixed window state persistence on minimize-to-tray so the active monitor and display bounds are properly preserved across sessions; restoreMainWindow now accurately nudges and restores the window onto the designated saved monitor before maximizing, and second-instance window activation is delegated to the unified window restore handler for consistent multi-display behavior.
- Donation and support guidance harmonized across documentation to align with the CyberGems application suite, and repository share badges reorganized for quicker access to Reddit and direct channels.

### 🇪🇸 Español

- Corregidos los bloqueos severos de la interfaz y el alto consumo de CPU/memoria al cargar historiales grandes de notificaciones (más de 1,000 elementos): renderizado progresivo por lotes (50 a 80 elementos por tanda) con IntersectionObserver para un scroll fluido en los paneles de Historial y Bandeja de entrada, componentes de tarjetas memoizados para frenar re-renderizados en cascada, y las notificaciones entrantes usan throttling por lotes de 500ms para mantener alta tasa de frames durante sondeos intensivos.
- Corregida la persistencia del estado de la ventana al minimizar a la bandeja: el monitor activo y los límites de pantalla se conservan correctamente entre sesiones; restoreMainWindow ahora devuelve la ventana con precisión a su monitor guardado antes de maximizar, y la activación de la segunda instancia usa el mismo controlador de restauración unificado para un comportamiento multi-monitor consistente.
- Guías de donación y soporte armonizadas en la documentación para alinearse con la suite CyberGems, e insignias para compartir del repositorio reorganizadas para un acceso más rápido a Reddit y canales directos.

## [1.19.0] - 2026-09-16

### 🇺🇸 English

- Resolved YouTube embed error 153 by injecting canonical Referer headers and sanitizing request headers for video embeds.
- New dedicated setting in Reading Preferences toggles between in-app YouTube video playback and opening directly in your default browser; embedded YouTube players now initialize cleanly in a paused state when opening articles, and the interactive play button overlay on video thumbnails is enlarged and refined.
- Application icons refreshed with a sleek squircle design across all resolutions and taskbar shortcuts.
- Smooth bidirectional tray icon animation (frames ping-ponging) indicates active background feed polling, and the tray context menu synchronizes with real-time recent articles, displaying titles and timestamps for one-click access.
- Redesigned update notification modal with an instant release notes peek, plus flexible update controls: update immediately, view full notes, or skip the current release version.
- Article title selection highlights from the very first character without drag boundary clipping, integrating seamlessly with the floating selection toolbar for rapid copying, Google searches, or translation.
- Notification badges adaptively adopt your active theme accent color and switch to an alert indicator when reaching the configured history limit; compact notification cards gain clearer relative timestamps, improved spacing, and stable card dimensions, and the muted feeds indicator moved to a clean header badge in Settings to eliminate layout shifts.
- About modal footer harmonized with CyberGems ecosystem standards, featuring updated icon layouts and an animated support badge; full bilingual coverage across English and Spanish for all new preferences and dialogues.

### 🇪🇸 Español

- Resuelto el error 153 de los embeds de YouTube inyectando cabeceras Referer canónicas y saneando las cabeceras de las peticiones de video.
- Nueva opción en Preferencias de lectura para alternar entre reproducir YouTube dentro de la app o abrirlo directamente en tu navegador por defecto; los reproductores incrustados de YouTube arrancan limpiamente en pausa al abrir artículos, y el botón de reproducción sobre las miniaturas es más grande y refinado.
- Iconos de la aplicación renovados con un diseño squircle elegante en todas las resoluciones y accesos de la barra de tareas.
- Animación bidireccional suave del icono de la bandeja (fotogramas que van y vienen) indica sondeo activo de feeds en segundo plano, y el menú contextual del tray se sincroniza con los artículos recientes en tiempo real, mostrando títulos y horas de un solo clic.
- Modal de actualización rediseñado con vista previa instantánea de las notas de la versión y controles flexibles: actualizar de inmediato, ver las notas completas o saltar esta versión.
- La selección del título del artículo resalta desde el primer carácter sin recortes en los límites del arrastre, integrándose sin costuras con la barra flotante de selección para copiar rápido, buscar en Google o traducir.
- Las insignias de notificación adoptan adaptativamente el color de acento del tema activo y cambian a un indicador de alerta al alcanzar el límite de historial configurado; las tarjetas compactas ganan tiempos relativos más claros, mejor espaciado y dimensiones estables, y el indicador de feeds silenciados pasa a una insignia limpia en la cabecera de Ajustes para eliminar saltos de diseño.
- Pie del modal Acerca de armonizado con los estándares del ecosistema CyberGems, con disposición de iconos actualizada e insignia de soporte animada; cobertura bilingüe completa en inglés y español para todas las preferencias y diálogos nuevos.

## [1.18.0] - 2026-09-14

### 🇺🇸 English

- Enriched YouTube feeds: improved channel resolution, metadata, thumbnail handling, and error reporting; featured images now include an interactive play overlay with embedded in-app video playback, and YouTube articles avoid unnecessary full-page extraction while preserving canonical video identity.
- Article text selection flyout: select article text to search Google, copy, or translate without leaving the viewer; selection is preserved while content refreshes, the viewer forwards wheel scrolling correctly, and more resilient media-error handling prevents viewer crashes and preserves the surrounding content.
- Twitter/X-style floating pill announces newly available articles during background polling, and active selection and reading state are preserved when fresh content arrives.
- Article list controls, smart-view icons, and viewer interactions received a broad accessibility and polish pass.
- Configurable notification history limits with accurate counts across badges; recent notifications are available from the tray with feed icons and manual badge clearance, and compact notification cards now use more reliable sizing, wider actions, relative times, and multi-line descriptions.
- Faster OPML imports and bulk feed controls, better YouTube feed suggestions, and a direct CyberFeeds release feed example using the official app icon; first-run onboarding and feed setup flows are clearer and more consistent.
- CyberClock-inspired icon tiles improve settings navigation and section headings; titlebar menus, sidebar navigation, tooltips, feed favicons, and article context actions were refined, and translation parsing and fallback validation are more robust, including Spanish UI coverage.

### 🇪🇸 Español

- Feeds de YouTube enriquecidos: mejor resolución de canales, metadatos, manejo de miniaturas e informes de error; las imágenes destacadas incorporan una capa de reproducción interactiva para ver los videos dentro de la app, y los artículos de YouTube evitan extracciones innecesarias de la página completa conservando la identidad canónica del video.
- Menú flotante de selección de texto: selecciona texto del artículo para buscar en Google, copiar o traducir sin salir del visor; la selección se conserva al refrescarse el contenido, el visor reenvía correctamente el scroll de la rueda y un manejo de errores de medios más resiliente evita crashes y preserva el contenido circundante.
- Una píldora flotante estilo Twitter/X anuncia los artículos disponibles durante el sondeo en segundo plano, y la selección activa y el estado de lectura se conservan cuando llega contenido nuevo.
- Los controles de la lista de artículos, los iconos de vistas inteligentes y las interacciones del visor recibieron una pasada amplia de accesibilidad y pulido.
- Límites configurables del historial de notificaciones con recuentos exactos en las insignias; las notificaciones recientes están disponibles en la bandeja con iconos de feed y limpieza manual de la insignia, y las tarjetas compactas usan tamaños más fiables, acciones más anchas, tiempos relativos y descripciones multilínea.
- Importaciones OPML más rápidas y controles de feeds por lote, mejores sugerencias de feeds de YouTube y un ejemplo directo del feed de lanzamientos de CyberFeeds con el icono oficial; los flujos de onboarding y configuración de feeds iniciales son más claros y consistentes.
- Mosaicos de iconos inspirados en CyberClock mejoran la navegación de ajustes y los encabezados de sección; menús de la barra de título, navegación lateral, tooltips, favicons de feeds y acciones contextuales de artículos se refinaron, y el análisis de traducciones y la validación de fallbacks son más robustos, incluida la cobertura de interfaz en español.

## [1.17.0] - 2026-09-01

### 🇺🇸 English

- First-class YouTube integration: direct support for @handles, channel pages, playlists, and video URLs with automatic fast XML feed resolution, canonical video GUID normalization (yt:video:ID), high-res thumbnail extraction, and automatic SQLite deduplication to eliminate repeated articles and double notifications.
- Modern Reddit and fast feed fetching: direct standard Desktop User-Agent with fast 5.5-second timeout and smart retries, and sanitized modern www.reddit.com URLs across all browser actions and feed parsing.
- 4-frame animated tray icon: an ultra-smooth, high-DPI fetching indicator right in the Windows system tray, with dynamic multi-resolution .ico updates across the taskbar and notifications.
- Titlebar More Options (...) dropdown: compact titlebar with quick access to Donate, feed controls, diagnostic Feeds Doctor, documentation, FAQ, changelog, and website; the titlebar brand logo and text are clickable to open the About dialog.
- New sober monochrome Grayscale (Gris) theme with charcoal backgrounds and silver accents, with the default theme officially named CyberFeeds; all themes are clearly labeled by their signature color (CyberFeeds, Gris, Blanco, Morado, Azul, Amarillo).
- Tray context menu enhancements: interactive branding header opening the About modal, and a dedicated Help submenu with direct links to Documentation, FAQ, Changelog, Website, and Donate.

### 🇪🇸 Español

- Integración YouTube de primera clase: soporte directo de @handles, páginas de canal, playlists y URLs de video con resolución rápida automática del feed XML, normalización canónica de GUIDs de video (yt:video:ID), extracción de miniaturas en alta resolución y deduplicación automática en SQLite para eliminar artículos repetidos y notificaciones dobles.
- Reddit moderno y obtención rápida de feeds: User-Agent de escritorio estándar con timeout rápido de 5.5 segundos y reintentos inteligentes, y URLs modernas de www.reddit.com saneadas en todas las acciones del navegador y el análisis de feeds.
- Icono de bandeja animado de 4 fotogramas: un indicador de obtención ultrafluida y de alta densidad en la bandeja de Windows, con actualizaciones dinámicas del .ico multirresolución en la barra de tareas y las notificaciones.
- Desplegable Más opciones (...) en la barra de título: barra compacta con acceso rápido a Donar, controles de feeds, Feeds Doctor de diagnóstico, documentación, FAQ, changelog y web; el logo y el texto de la marca en la barra de título abren el About al hacer clic.
- Nuevo tema monocromo sobrio Gris con fondos carbón y acentos plateados, con el tema por defecto nombrado oficialmente CyberFeeds; todos los temas están etiquetados claramente por su color distintivo (CyberFeeds, Gris, Blanco, Morado, Azul, Amarillo).
- Mejoras del menú contextual de la bandeja: cabecera de marca interactiva que abre el modal Acerca de y un submenú de Ayuda con enlaces directos a Documentación, FAQ, Changelog, Web y Donar.

## [1.16.0] - 2026-08-23

### 🇺🇸 English

- Eliminated article row overlap: fixed key tracking in @tanstack/react-virtual when feed articles update via background polling, preventing rows from visually overlapping or forming empty gaps.
- Smooth auto-scroll and viewport stability: resolved infinite render loops during article loading and stabilized auto-scroll navigation.
- Home and End keyboard navigation: press Home or End in the article list to instantly jump to and select the first or last article.
- Direct settings shortcut in the notifier: a dedicated settings button in the top bar with a clean divider, deep-linking directly to the Notifications tab.
- Dynamic remaining cards counter: the "more" pill dynamically discounts cards as you scroll down and smoothly disappears upon reaching the bottom.
- Adaptive height and action button padding: calibrated base heights and live measurements so action buttons are never cut off for single or dual notifications, plus a symmetrical bottom fade aligned across the full card width.

### 🇪🇸 Español

- Eliminado el solapamiento de filas: corregido el seguimiento de claves en @tanstack/react-virtual cuando los artículos se actualizan por sondeo en segundo plano, evitando filas superpuestas visualmente o huecos vacíos.
- Auto-scroll suave y estabilidad del viewport: resueltos los bucles infinitos de render durante la carga de artículos y estabilizada la navegación por auto-scroll.
- Navegación por teclado Inicio y Fin: pulsa Inicio o Fin en la lista de artículos para saltar y seleccionar al instante el primer o último artículo.
- Acceso directo a ajustes en el notificador: un botón dedicado de ajustes en la barra superior con un divisor limpio, que enlaza directamente a la pestaña de Notificaciones.
- Contador dinámico de tarjetas restantes: la píldora "más" descuenta tarjetas al desplazarte hacia abajo y desaparece suavemente al llegar al final.
- Altura adaptativa y espaciado de botones de acción: alturas base calibradas y mediciones en vivo para que los botones nunca se corten con una o dos notificaciones, además de un degradado inferior simétrico alineado a todo el ancho de la tarjeta.

## [1.15.0] - 2026-08-22

### 🇺🇸 English

- Human-friendly notification duration: the notification duration setting in the Settings Panel is converted from milliseconds (e.g. 8000) to seconds (e.g. 8.0s), making configuration clear and effortless.
- Active monitor support: a new "Active monitor (where cursor is)" option displays toast notifications dynamically on whichever screen currently holds the mouse cursor rather than locking to a fixed monitor, set as default for new installations.
- Reordered card actions: the Mute action button is positioned directly to the left of the View button in notification toast cards for a cleaner, more logical layout.

### 🇪🇸 Español

- Duración de notificación comprensible: el ajuste de duración en el panel de Ajustes pasa de milisegundos (p. ej. 8000) a segundos (p. ej. 8,0 s), haciendo la configuración clara y sencilla.
- Soporte de monitor activo: la nueva opción "Monitor activo (donde está el cursor)" muestra los avisos dinámicamente en la pantalla que contenga el cursor en lugar de fijarse en un monitor concreto, y queda como predeterminada en instalaciones nuevas.
- Acciones de tarjeta reordenadas: el botón de Silenciar se sitúa directamente a la izquierda del botón Ver en las tarjetas de notificación para una composición más limpia y lógica.

## [1.14.0] - 2026-08-22

### 🇺🇸 English

- Optional instant search: a new setting toggles instant search on or off; by default, searching large databases now triggers on Enter or search icon click, eliminating typing lag across thousands of articles.
- Responsive search bar: dynamic input placeholder on focus, tooltip hints, dedicated clear button, and immediate feedback loader indicating search operations.
- Categorized notifications settings: the Notification settings are restructured into 5 clean, modular cards with bilingual labels (General, Display & Position, Timing & Stacking, Sound Alert, and Ignored Feeds).
- Enhanced notifier experience: improved stack peek interaction, smoother tray blinking sync, and precise monitor bounds validation.
- Live font size preview: when adjusting sidebar or article list font sizes via the sliders or arrow keys, the modal backdrop blur and dimming temporarily hide, letting you preview font size changes live across the UI.
- User-confirmed updates: automatic background downloading on startup is eliminated; when a new release is detected the app announces it and waits for explicit user confirmation before initiating download, with instant progress bar activation upon clicking Download.

### 🇪🇸 Español

- Búsqueda instantánea opcional: un nuevo ajuste la activa o desactiva; por defecto, buscar en bases grandes ahora se dispara con Enter o el clic en el icono de búsqueda, eliminando el retraso al teclear entre miles de artículos.
- Barra de búsqueda más responsiva: placeholder dinámico al enfocar, pistas en el tooltip, botón de limpieza dedicado y un indicador de carga inmediato que señala las operaciones de búsqueda.
- Ajustes de notificaciones categorizados: la configuración de notificaciones se reorganiza en 5 tarjetas modulares y limpias con etiquetas bilingües (General, Pantalla y posición, Tiempos y apilado, Alerta sonora y Feeds ignorados).
- Experiencia del notificador mejorada: interacción de asomo de la pila más pulida, parpadeo del tray mejor sincronizado y validación precisa de los límites del monitor.
- Vista previa en vivo del tamaño de fuente: al ajustar los tamaños de fuente de la barra lateral o la lista de artículos con los deslizadores o las flechas, el desenfoque y el oscurecido del fondo del modal se ocultan temporalmente, permitiendo previsualizar los cambios en toda la interfaz en tiempo real.
- Actualizaciones con confirmación del usuario: se elimina la descarga automática en segundo plano al arrancar; al detectar una versión nueva la app la anuncia y espera confirmación explícita antes de descargar, con barra de progreso inmediata al pulsar Descargar.

## [1.13.0] - 2026-08-21

### 🇺🇸 English

- Arrow Up/Down now moves between articles (including from the search box) instead of only scrolling the viewport, and article cards show the feed folder next to the timestamp.
- Linked images in the reader use a pointer cursor so they look clickable, and unplayable video shells (endless spinners and "Play video content" placeholders) are hidden.
- Status LED matches real polling: dim and still while the window is open with unfocused-only fetching, pulsing only when updates can actually run; a settings hint under "only fetch when not focused" explains that auto-fetch pauses while you read and resumes when minimized or in the tray.
- Mute feeds from a toast, the sidebar, or Settings without pausing fetch, and the visible stack now respects the max-stack setting with extra cards waiting in queue.
- Bottom-left/right placement stays closer to the screen edge and is less likely to jump to mid-screen; the position picker previews immediately and preview toasts appear faster.
- Refreshed application icon and tray frames.
- Article rows no longer overlap after the window was hidden or refreshed in the background, default white focus rings on buttons and tooltips are removed, and tray menu icon colors and notification labels are restored and unified.

### 🇪🇸 Español

- Las flechas Arriba/Abajo ahora se mueven entre artículos (incluido desde el buscador) en lugar de solo desplazar el viewport, y las tarjetas de artículos muestran la carpeta del feed junto a la hora.
- Las imágenes con enlace en el lector usan cursor de puntero para que se vean clicables, y las carcasas de video sin reproducción (spinners infinitos y placeholders de "Ver contenido de video") se ocultan.
- El LED de estado refleja el sondeo real: apagado y quieto con la ventana abierta y obtención solo sin foco, pulsando solo cuando las actualizaciones pueden ejecutarse de verdad; una pista en Ajustes bajo "obtener solo sin foco" explica que la obtención automática se pausa mientras lees y se reanuda al minimizar o en la bandeja.
- Silencia feeds desde un toast, la barra lateral o Ajustes sin pausar la obtención, y la pila visible respeta ahora el ajuste de pila máxima con las tarjetas extra esperando en cola.
- La colocación inferior izquierda/derecha queda más pegada al borde de la pantalla y salta menos al centro; el selector de posición previsualiza al instante y los toasts de vista previa aparecen más rápido.
- Icono de la aplicación y fotogramas del tray renovados.
- Las filas de artículos ya no se solapan tras ocultar o refrescar la ventana en segundo plano, se eliminan los anillos de foco blancos por defecto en botones y tooltips, y los colores de iconos del menú del tray y las etiquetas de notificación se restauran y unifican.

## [1.12.0] - 2026-08-20

### 🇺🇸 English

- Full poll cycle synchronization: notifications accumulate across the entire background feed fetching cycle, presenting a single consolidated batch once all feeds finish instead of triggering multiple fragmented popups, with remote article thumbnails preloaded in parallel before the notification window opens to eliminate staggered card jumps.
- Reduced notification window dimensions with balanced width across languages, smooth GPU-accelerated slide and fade-out card dismissal animation, and a soft breathing pulse on the active countdown indicator that automatically pauses when hovered.
- Opaque control buttons: solid backgrounds for top notification actions to prevent blend-in with desktop wallpaper or background windows.
- In-app article viewing control: an optional setting under Notifications ("Close notification window when viewing in app", default off) keeps the rest of the batch visible when opening an article in the app.
- Tray icon activity: a vibrant cyan LED overlay blinks smoothly during background feed fetching or notification batch preparation, with a dynamic tray tooltip showing "Loading feeds..." during polling and reverting to the app version when idle.
- Startup fetch with configurable delay: a new toggle with preset delay options (0s, 5s, 10s, 15s, 30s, 1m, 2m, 5m) controls when the initial feed refresh occurs on launch, and an unfocused polling option (default on) skips scheduled background polling cycles while the application is active and focused.
- Article list cards refinement: publication times are permanently pinned to the right edge for clear visibility, feed titles and author labels use the available card width fluidly without premature truncation, and settings cards are reorganized with right-aligned numeric inputs and well-spaced toggle rows.
- Global app icon refresh: updated high-resolution application icons (.ico, .png, and tray frames) across the entire application.

### 🇪🇸 Español

- Sincronización con el ciclo completo de sondeo: las notificaciones se acumulan durante todo el ciclo de obtención de feeds en segundo plano y se presentan en un único lote consolidado al terminar todos los feeds en lugar de disparar múltiples popups fragmentados, con las miniaturas remotas precargadas en paralelo antes de abrir la ventana de notificaciones para eliminar saltos escalonados.
- Dimensiones de la ventana de notificaciones reducidas con ancho equilibrado entre idiomas, animación de salida de tarjetas suave acelerada por GPU, y un pulso de respiración suave en el indicador de cuenta regresiva que se pausa automáticamente al pasar el cursor.
- Botones de control opacos: fondos sólidos para las acciones superiores de las notificaciones para que no se fundan con el fondo de pantalla u otras ventanas.
- Control de visualización en la app: una opción bajo Notificaciones ("Cerrar ventana de notificaciones al ver en la app", desactivada por defecto) mantiene el resto del lote visible al abrir un artículo en la app.
- Actividad del icono del tray: un LED cian vibrante parpadea suavemente durante la obtención de feeds o la preparación de lotes de notificaciones, con un tooltip dinámico que muestra "Cargando feeds..." durante el sondeo y vuelve a la versión de la app en reposo.
- Obtención al inicio con demora configurable: un nuevo interruptor con opciones predefinidas (0 s, 5 s, 10 s, 15 s, 30 s, 1 m, 2 m, 5 m) controla cuándo ocurre el primer refresco de feeds al arrancar, y una opción de sondeo sin foco (activada por defecto) salta los ciclos programados en segundo plano mientras la aplicación está activa y enfocada.
- Refinamiento de las tarjetas de artículos: las horas de publicación quedan fijadas permanentemente al borde derecho para visibilidad clara, los títulos de feed y las etiquetas de autor usan el ancho de la tarjeta con fluidez sin truncarse antes de tiempo, y las tarjetas de ajustes se reorganizan con campos numéricos alineados a la derecha y filas de interruptores bien espaciadas.
- Refresco global de iconos: iconos de la aplicación en alta resolución (.ico, .png y fotogramas del tray) actualizados en toda la aplicación.

## [1.11.0] - 2026-08-15

### 🇺🇸 English

- Added the horizontal split reading layout with sidebar support.
- Stabilized featured images and removed duplicate article images.
- Added notification auto-hide countdown feedback.
- Updated the Spanish notification action to "Pausar".

### 🇪🇸 Español

- Añadida la disposición de lectura en división horizontal con soporte de barra lateral.
- Imágenes destacadas estabilizadas e imágenes de artículos duplicadas eliminadas.
- Añadida la retroalimentación de cuenta regresiva del auto-ocultado de notificaciones.
- La acción de notificación en español pasa a "Pausar".

## [1.10.0] - 2026-08-15

### 🇺🇸 English

- Full article Trash with restore, permanent deletion, and empty-trash actions, plus automatic 30-day retention; trash items are excluded from active article lists, unread counts, Favorites, Inbox, and backups, and existing databases are migrated automatically.
- Dedicated Trash view and counter while keeping active article totals consistent with visible content.
- Bilingual English and Spanish UI copy for Trash workflows and maintenance information.
- Improved article deletion feedback with strikethrough titles and grayscale featured images.
- Improved keyboard and context-menu navigation so the selected article stays visible while advancing through the list.
- Added an unread-articles sidebar view.

### 🇪🇸 Español

- Papelera completa de artículos con acciones de restaurar, borrado permanente y vaciado, más retención automática de 30 días; los elementos en la papelera quedan excluidos de las listas activas, los contadores de no leídos, Favoritos, la Bandeja de entrada y las copias de seguridad, y las bases de datos existentes se migran automáticamente.
- Vista dedicada de la papelera con contador, manteniendo los totales de artículos activos consistentes con el contenido visible.
- Textos de interfaz bilingües en inglés y español para los flujos de papelera y la información de mantenimiento.
- Retroalimentación de borrado mejorada con títulos tachados e imágenes destacadas en escala de grises.
- Navegación por teclado y menú contextual mejorada para que el artículo seleccionado siga visible al avanzar por la lista.
- Añadida una vista de artículos no leídos en la barra lateral.

## [1.9.3] - 2026-08-15

### 🇺🇸 English

- Newly added feeds are selected automatically and show a polished bilingual loading state while their first articles are fetched.
- Individual feed and folder refreshes now keep the animated refresh icon visible until the scan actually finishes.
- Feed and folder context menus preserve the visual highlight of their associated item.
- Refined the orange CyberFeeds branding, About glow, notification badge, and tray menu icons.

### 🇪🇸 Español

- Los feeds recién añadidos se seleccionan automáticamente y muestran un estado de carga bilingüe pulido mientras llegan sus primeros artículos.
- Los refrescos individuales de feed y carpeta mantienen ahora el icono animado de refresco visible hasta que el escaneo termina de verdad.
- Los menús contextuales de feeds y carpetas conservan el resaltado visual de su elemento asociado.
- Refinada la marca naranja de CyberFeeds, el brillo del About, la insignia de notificación y los iconos del menú del tray.

## [1.9.2] - 2026-08-13

### 🇺🇸 English

- Copying a featured image from the article list or an image inside an article is now instant when the picture is already on screen instead of re-downloading it; the context menu no longer waits on the network.
- Search on Google: right-click selected text in an article to search it in your configured browser.
- Updated branding across the installer, window, and tray; the tray icon is rendered at display DPI so it stays sharp on HiDPI, matching the taskbar.
- Clicking the CyberFeeds version header in the tray menu opens About, following the CyberViewer pattern.
- Delete actions keep their labels; only the trash icons are red.

### 🇪🇸 Español

- Copiar una imagen destacada de la lista de artículos o una imagen dentro de un artículo es ahora instantáneo cuando la imagen ya está en pantalla, en lugar de volver a descargarla; el menú contextual ya no espera a la red.
- Buscar en Google: click derecho sobre texto seleccionado de un artículo para buscarlo en tu navegador configurado.
- Marca actualizada en instalador, ventana y bandeja; el icono del tray se renderiza al DPI de la pantalla para mantenerse nítido en HiDPI, a la par de la barra de tareas.
- Pulsar la cabecera de versión de CyberFeeds en el menú del tray abre Acerca de, siguiendo el patrón de CyberViewer.
- Las acciones de borrar conservan su etiqueta; solo los iconos de papelera van en rojo.

## [1.9.1] - 2026-08-12

### 🇺🇸 English

- Fixed notifications dismissing when clicking the "Open" button, and improved synchronization of the pause-feeds toggle from the user interface.
- Fixed the copy image action in both the article list context menu and the article viewer context menu, with optimized image copying performance.
- Fixed caret cursor visibility on images.

### 🇪🇸 Español

- Corregido el cierre de notificaciones al pulsar el botón "Abrir", y mejorada la sincronización del interruptor de pausa de feeds desde la interfaz.
- Corregida la acción de copiar imagen tanto en el menú contextual de la lista de artículos como en el del visor, con el rendimiento de copia optimizado.
- Corregida la visibilidad del cursor de texto sobre las imágenes.

## [1.9.0] - 2026-08-12

### 🇺🇸 English

- Pause/Resume feeds: a toggle button in the top bar and tray context menu pauses or resumes feed updates.
- Notification control: a new setting suppresses notification popups when a fullscreen application is active on Windows.
- Article viewer improvements: rewritten context menu and text selection handling, a footer link preview, and a toggle for content auto-fetch.
- UI and brand updates: updated tray and app icons, exit transition animations for the settings panel, and refined About dialog spacing.
- Prevented duplicate notifications from Reddit RSS/JSON fallback loops by normalizing item GUIDs.
- Fixed window maximized state preservation on app restart, and the tray icon tooltip now shows the app version dynamically.

### 🇪🇸 Español

- Pausar/Reanudar feeds: un botón en la barra superior y el menú contextual del tray pausa o reanuda las actualizaciones de feeds.
- Control de notificaciones: un nuevo ajuste suprime los avisos emergentes cuando una aplicación a pantalla completa está activa en Windows.
- Mejoras del visor de artículos: menú contextual y manejo de selección de texto reescritos, vista previa de enlaces en el pie y un interruptor para la obtención automática de contenido.
- Novedades de interfaz y marca: iconos del tray y de la app actualizados, animaciones de salida en el panel de ajustes y espaciado del About refinado.
- Evitadas las notificaciones duplicadas de los bucles de fallback RSS/JSON de Reddit normalizando los GUID de los ítems.
- Corregida la conservación del estado maximizado de la ventana al reiniciar la app, y el tooltip del icono del tray muestra ahora la versión de la app dinámicamente.

## [1.8.1] - 2026-07-30

### 🇺🇸 English

- Fixed empty content appearing in the reader when full-article extraction failed.
- Optimized article list controls and layout.

### 🇪🇸 Español

- Corregido el contenido vacío en el lector cuando fallaba la extracción del artículo completo.
- Optimizados los controles y la disposición de la lista de artículos.

## [1.8.0] - 2026-07-29

### 🇺🇸 English

- Today's Inbox ("Daily Digest" mode) re-designed: a modern magazine-style cards layout where articles are grouped by feed source, featuring status markers (read/unread) and quick hover actions to star or mark articles read.
- Rich notification cards in history: the notification history panel now mirrors actual system notification cards with full visual styles, thumbnails, and action triggers.
- Auto-fetch full article: the manual "Full Article" button in the reader view is replaced with fully automatic background fetching of the full article content on selection.
- Window maximize/restore toggle: the custom title bar maximization buttons are re-architected to track the actual window state, showing an inward-arrow icon and dynamic tooltip when restoring.
- Minimize-to-tray tooltip: with "Minimize to Tray on Close" active, the window close button dynamically displays "Minimize to tray" instead of "Close".
- Position-aware tooltips: sidebar footer tooltips shift upwards to prevent clipping on small screen heights.
- Double render fix: resolved a React rendering bug where a database read state was printed as a text character "0" in feed card footers.

### 🇪🇸 Español

- La Bandeja de hoy (modo "Resumen diario") rediseñada: tarjetas modernas estilo revista donde los artículos se agrupan por fuente, con marcadores de estado (leído/no leído) y acciones rápidas al pasar el cursor para destacar o marcar artículos como leídos.
- Tarjetas de notificaciones ricas en el historial: el panel de historial replica ahora las tarjetas reales de notificaciones del sistema con estilos visuales completos, miniaturas y acciones.
- Obtención automática del artículo completo: el botón manual "Artículo completo" del lector se sustituye por la obtención en segundo plano y automática del contenido completo al seleccionar el artículo.
- Botón de maximizar/restaurar: los botones de maximizado de la barra de título se rearquitectan para seguir el estado real de la ventana, mostrando un icono de flecha interior y tooltip dinámico al restaurar.
- Tooltip de minimizar a la bandeja: con "Minimizar a la bandeja al cerrar" activo, el botón de cierre de la ventana muestra dinámicamente "Ocultar a la bandeja" en lugar de "Cerrar".
- Tooltips conscientes de la posición: los tooltips del pie de la barra lateral se desplazan hacia arriba para evitar recortes en pantallas bajas.
- Corrección del doble render: resuelto un bug de React que imprimía un estado de lectura de la base de datos como el carácter de texto "0" en el pie de las tarjetas de feed.

## [1.7.0] - 2026-07-27

### 🇺🇸 English

- Settings vertical navigation (CyberTray-style) with live-save feedback, and a theme picker with swatches in two columns.
- Notification open behavior: choose CyberFeeds or browser (uses the General browser setting).
- Clearer shortcuts UI and bilingual labels.
- Slimmer About modal with GitHub / Issues / Releases links and diagnostic copy.
- Back-to-top button in the article viewer.
- Native text context menu on form fields (cut/copy/paste/delete/select all).
- Modals no longer close when selecting text and dragging outside.
- Stronger Reddit feed detection (canonical URLs, RSS-first fallbacks, clearer 429 errors).
- Startup/window polish and notifier improvements from recent builds.

### 🇪🇸 Español

- Navegación vertical de Ajustes (estilo CyberTray) con guardado en vivo, y selector de tema con muestras en dos columnas.
- Comportamiento de apertura de notificaciones: elegir CyberFeeds o navegador (usa el ajuste de navegador de General).
- Interfaz de atajos más clara y etiquetas bilingües.
- Modal Acerca de más esbelto con enlaces a GitHub / Issues / Releases y texto de diagnóstico.
- Botón de volver arriba en el visor de artículos.
- Menú contextual de texto nativo en los campos de formulario (cortar/copiar/pegar/borrar/seleccionar todo).
- Los modales ya no se cierran al seleccionar texto y arrastrar fuera.
- Detección de feeds de Reddit más robusta (URLs canónicas, fallbacks RSS primero, errores 429 más claros).
- Pulido de arranque y ventana, y mejoras del notificador de builds recientes.

## [1.6.7] - 2026-06-14

### 🇺🇸 English

- Shortcut defaults: only Show/Hide (Alt+Shift+S) has an accelerator; others start empty.
- The reset button now only resets shortcuts, preserving other unsaved panel changes.
- The global/app toggle works for all shortcuts, auto-enabling on record and auto-disabling on clear.
- Layout: the X clear buttons are now positioned next to the recorder input, square and centered.
- Toggle polish: fixed-width label text to prevent layout shift, and the disabled gray styling is removed.
- The HotkeyRecorder language detection now uses the useTranslation hook correctly.
- The language selector applies immediately, with no Save required.

### 🇪🇸 Español

- Valores por defecto de atajos: solo Mostrar/Ocultar (Alt+Shift+S) tiene acelerador; los demás empiezan vacíos.
- El botón de restablecer ahora solo reinicia los atajos, conservando los demás cambios sin guardar del panel.
- El interruptor global/app funciona para todos los atajos: se activa automáticamente al grabar y se desactiva al limpiar.
- Diseño: los botones X de limpiar se sitúan ahora junto al campo de grabación, cuadrados y centrados.
- Pulido de interruptores: etiquetas de ancho fijo para evitar saltos de diseño, y se retira el estilo gris de deshabilitado.
- La detección de idioma de HotkeyRecorder usa ahora el hook useTranslation correctamente.
- El selector de idioma se aplica al instante, sin necesidad de pulsar Guardar.

## [1.6.0] - 2026-06-04

### 🇺🇸 English

- Automatic updates: CyberFeeds can now update itself. Open the About dialog and use "Check for updates"; available updates download in the background and install on restart, and a toggle lets you choose Automatic (checks on launch) or Manual only.
- Assisted installer: the Windows installer is now a step-by-step wizard to pick the install location, per-user or per-machine, desktop/start-menu shortcuts, and a proper entry in Add/Remove Programs for clean uninstalls.
- New CyberGems-styled dialog system: custom confirmation and alert dialogs replace the native browser pop-ups across the app (delete feed/folder, delete all articles, doctor panel, backup import/export), with variant-aware styling, keyboard support, and animations.
- Notifications: a new "Open" action opens the article link directly in your configured browser, alongside the existing in-app "View".
- "Start minimized to tray" is now greyed out unless "Start with Windows" is enabled, making it clear the option only applies to a Windows-startup launch.
- Sidebar refinements: more elegant folder headers, right-aligned folder names, prominent folder unread badges, and tasteful dividers between folders.

### 🇪🇸 Español

- Actualizaciones automáticas: CyberFeeds ya puede actualizarse solo. Abre el About y usa "Buscar actualizaciones"; las actualizaciones disponibles se descargan en segundo plano y se instalan al reiniciar, y un interruptor permite elegir Automático (comprueba al arrancar) o Solo manual.
- Instalador asistido: el instalador de Windows es ahora un asistente paso a paso para elegir la ubicación de instalación, por usuario o por máquina, accesos directos de escritorio/menú inicio y una entrada correcta en Agregar o quitar programas para desinstalaciones limpias.
- Nuevo sistema de diálogos estilo CyberGems: diálogos personalizados de confirmación y alerta sustituyen a los pop-ups nativos del navegador en toda la app (borrar feed/carpeta, borrar todos los artículos, panel doctor, importar/exportar copias), con estilos según variante, soporte de teclado y animaciones.
- Notificaciones: una nueva acción "Abrir" abre el enlace del artículo directamente en tu navegador configurado, junto a la existente "Ver" dentro de la app.
- "Iniciar minimizado en la bandeja" se atenúa salvo que "Iniciar con Windows" esté activado, dejando claro que la opción solo aplica a un lanzamiento al inicio de Windows.
- Refinamientos de la barra lateral: cabeceras de carpetas más elegantes, nombres alineados a la derecha, insignias de no leídos de las carpetas más destacadas y divisores sutiles entre carpetas.
