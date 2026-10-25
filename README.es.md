<p align="center">
  <a href="./README.md">English</a> · Español
</p>

<p align="center">
  <a href="https://cybergems.org/apps/cyberfeeds/">
    <img src="https://cybergems.org/banners/es/cyberfeeds.png" alt="CyberFeeds: lector RSS y Atom local-first para una lectura rápida, privada y limpia" />
  </a>
</p>

<p align="center">
  <a href="https://github.com/CyberGems/CyberFeeds/releases/latest"><img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FCyberGems%2FCyberFeeds%2Fmain%2Fpackage.json&query=%24.version&prefix=%20Descargar%20CyberFeeds%20v&suffix=%20&style=for-the-badge&label=&labelColor=0891B2&color=0891B2" alt="Descargar la última versión" /><img src="https://img.shields.io/badge/Windows_10%2F11_(64--bit)-2563EB?style=for-the-badge" alt="Windows 10/11 (64 bits)" /></a>
  &nbsp;<a href="https://github.com/CyberGems/CyberFeeds/releases"><img src="https://img.shields.io/badge/Todas_las_versiones-30363D?style=for-the-badge&logo=github&logoColor=white" alt="Todas las versiones" /><img src="https://img.shields.io/badge/Notas_de_la_versi%C3%B3n-475569?style=for-the-badge" alt="Notas de la versión" /></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Licencia-GPL--3.0-1F2428.svg?style=flat-square&color=334155" alt="Licencia" />&nbsp;
  <img src="https://img.shields.io/badge/Plataforma-Windows_10%2F11-1F2428.svg?style=flat-square&color=334155" alt="Plataforma" />&nbsp;
  <img src="https://img.shields.io/badge/Electron-34-1F2428.svg?style=flat-square&logo=electron&logoColor=white&color=334155" alt="Electron" />&nbsp;
  <a href="https://github.com/CyberGems/CyberFeeds/wiki"><img src="https://img.shields.io/badge/Wiki-Documentaci%C3%B3n-1F2428?style=flat-square&logo=gitbook&logoColor=white&color=334155" alt="Wiki" /></a>
</p>

---

## ¿Qué es CyberFeeds?

CyberFeeds es un lector de **RSS y Atom** local-first, enfocado en el rendimiento, para Windows. Suscríbete a sitios web, canales y listas de reproducción de YouTube, y feeds de Reddit; extrae artículos completos; busca en bibliotecas grandes; y organiza tu lectura con carpetas, estrellas, estados de leído y papelera. La obtención basada en workers mantiene la interfaz receptiva, mientras que las notificaciones inteligentes, el vídeo flotante, las copias de seguridad automáticas y una base de datos local SQLite te mantienen al día sin una cuenta ni servicio en la nube. Construido con **Electron + React + TypeScript**.

*Gratuito y de código abierto (GPLv3): sin anuncios, sin rastreo y sin recogida de datos. Solo disfrútalo.*

---

## 📡 ¿Por qué CyberFeeds?

La mayoría de los lectores RSS son envoltorios web lentos o proyectos abandonados. CyberFeeds está construido desde cero para el **rendimiento y la usabilidad**: los hilos worker mantienen la obtención receptiva, el modo WAL de SQLite maneja miles de artículos con fluidez, y un sistema de notificaciones propio asegura que no te pierdas actualizaciones importantes.

| Necesidad | Solución |
|---|---|
| Seguir RSS, Atom y Reddit | Soporte nativo de todos los formatos + subreddits y feeds de usuario de Reddit |
| Leer artículos completos | Extracción de contenido mediante hilos worker: sin resúmenes truncados |
| Mantente al día | Notificaciones inteligentes con filtrado por palabras clave, pospuesto (snooze) y soporte multi-monitor |
| Gestiona bibliotecas grandes | Listas virtualizadas, búsqueda, estrellas, leído/no leído y limpieza automática |
| Migrar desde otro lector | Importación/exportación OPML con la estructura de carpetas conservada |
| Conserva tus datos | Base de datos SQLite local: sin nube, sin cuentas, sin rastreo |

---

## ✨ Funciones principales

### 📰 Gestión de feeds
- **Soporte universal de feeds**: RSS, Atom y XML con descubrimiento automático
- **Canales de YouTube**: suscripciones nativas a canales, handles (@name), URL de vídeo y listas de reproducción, con reproducción en la app o en el navegador externo y miniaturas de CDN
- **Integración de Reddit**: soporte nativo de subreddits y feeds de usuario con cadena de respaldo (RSS → API JSON)
- **Importación/exportación OPML**: migra tus feeds con la estructura de carpetas conservada
- **Vista previa de feed**: previsualiza el contenido del feed antes de suscribirte
- **Doctor de feeds**: escáner diagnóstico de problemas de conectividad y análisis
- **Sondeo en segundo plano**: intervalos de actualización configurables con pausa/reanudación por feed y por carpeta

### 📖 Gestión de artículos
- **Extracción de contenido completo**: obtiene el artículo completo mediante hilos worker
- **Pestañas de artículos y restauración de sesión**: abre artículos en pestañas en segundo o primer plano, cámbialas desde un menú desplegable y restaura las pestañas abiertas entre sesiones
- **Búsqueda dentro del artículo**: búsqueda rápida de texto (`Ctrl+F`) con resaltado de coincidencias en tiempo real, contador y navegación a la coincidencia siguiente o anterior
- **Encabezado fijo del lector**: barra flotante con el icono de la fuente y el título al hacer scroll, más navegación rápida al inicio
- **Ventana flotante de selección**: busca el texto seleccionado, cópialo o tradúcelo desde los títulos y el cuerpo del artículo sin salir del lector
- **Marcar/destacar**: marca artículos como favoritos
- **Seguimiento de leído/no leído**: sabe de un vistazo qué has leído
- **Eliminación suave**: mueve los artículos a la papelera con purga automática a los 30 días
- **Búsqueda instantánea**: busca artículos con modos de búsqueda instantánea o al pulsar Intro
- **Listas virtualizadas y renderizado incremental**: desplazamiento suave en bibliotecas grandes de artículos y carga progresiva por lotes para paneles de notificaciones de gran volumen
- **Múltiples disposiciones**: vistas de tres paneles, dos paneles, un panel y división horizontal

### 🔔 Notificaciones inteligentes
- **Lotes unificados de escaneo**: los artículos detectados en cada ciclo de sondeo se entregan en una sola notificación consolidada, priorizando los más recientes
- **Ventana de notificación personalizada**: notificador integrado con agrupación, botones de acción y protección de pausa al desplazarse
- **Actualizaciones en vivo**: ve los artículos recién obtenidos en una píldora flotante sin perder tu posición en la lista
- **Filtrado por palabras clave**: recibe notificaciones solo de los temas que te importan
- **Historial de notificaciones**: límite de historial configurable, renderizado progresivo por lotes para más de 1.000 elementos, insignias adaptativas con el acento del tema y avisos de límite, y elementos recientes en la bandeja
- **Pospuesto (Snooze)**: pausa las notificaciones durante un tiempo configurable
- **Soporte multi-monitor**: elige qué pantalla muestra las notificaciones
- **Alertas de sonido**: sonidos de notificación personalizados
- **Detección de pantalla completa**: suprime las notificaciones durante juegos o vídeos

### 🖥️ Integración con escritorio
- **Barra superior dinámica**: rota saludos contextuales según la hora, contador de artículos sin leer, estado de sincronización, feeds activos y fecha con pausa al pasar el cursor y clic directo
- **Bandeja del sistema**: minimizar a la bandeja, menú de acciones rápidas, submenú de artículos recientes en tiempo real, acceso directo con diamante de la suite y animación durante el sondeo
- **Memoria de ventana multi-monitor**: recuerda automáticamente los límites de la pantalla activa y restaura la ventana en el monitor designado
- **Atajos globales**: accesos configurables (mostrar/ocultar predeterminado: `Alt+S`)
- **Inicio automático**: opción de iniciar con Windows
- **Actualizaciones automáticas interactivas**: comprobador de actualizaciones integrado con vista previa del changelog, actualización inmediata y opciones de omisión de versión
- **Detección de navegadores personalizados**: descubre automáticamente navegadores instalados (Chrome, Edge, Firefox, Brave, Opera, Vivaldi) o configura un ejecutable personalizado
- **Instalador NSIS temático**: asistente con banner lateral temático, soporte multilingüe y accesos directos limpios

### 🎨 Personalización
- **3 temas armónicos**: CyberFeeds (oscuro predeterminado), Gris (escala de grises sin distracciones) y Claro
- **Interruptores modernos de la suite**: conmutadores tipo píldora interactivos con checkmarks táctiles y acentos reactivos al tema
- **Personalización de saludos**: configura tu nombre, usa el título por defecto o déjalo vacío para saludos puros
- **Escala de interfaz**: ajusta rápidamente la escala general desde el panel de bienvenida, con controles independientes detallados de interfaz y lector en Configuración
- **Preferencias de lectura**: tamaño de fuente, interlineado, ancho máximo, tema de lectura (Predeterminado, Sepia, Oscuro) y conmutador de reproducción de YouTube en la app
- **Interfaz bilingüe**: interfaz completa en inglés y español

### 💾 Gestión de datos
- **Copia de seguridad y restauración**: copia en formato JSON de feeds, carpetas y configuración
- **Limpieza automática**: elimina automáticamente artículos leídos antiguos
- **Base de datos SQLite**: almacenamiento local de alto rendimiento con modo WAL
---

## 🚀 Primeros pasos

### Instalación (recomendada)

1. Descarga el instalador más reciente desde [Releases](https://github.com/CyberGems/CyberFeeds/releases/latest)
2. Ejecuta el instalador `.exe` y sigue el asistente de instalación
3. Inicia CyberFeeds. No necesitas ningún otro requisito: **no** necesitas Node.js ni npm

### 🛡️ Windows SmartScreen

Windows puede mostrar un aviso de SmartScreen la primera vez que ejecutas el instalador de CyberFeeds: esta es una app de hobby sin firmar, así que Windows aún no ha construido reputación para el archivo. Esto es esperado; el código fuente es público para que puedas inspeccionar exactamente qué hace.

Para continuar:

<details>
<summary><strong>Cómo ejecutar el instalador (paso a paso)</strong></summary>

Windows muestra este aviso para cualquier instalador sin un certificado de firma de código de pago; no significa que el archivo sea inseguro. No hagas clic en "No ejecutar":

1. Ejecuta el instalador. Windows puede mostrar el diálogo azul "Windows protegió tu PC".

![Aviso de Windows SmartScreen](https://cybergems.org/branding/smartscreen-warning.svg)

2. Haz clic en el pequeño enlace **Más información**.

![Diálogo de SmartScreen tras Más información](https://cybergems.org/branding/smartscreen-runanyway.svg)

3. Haz clic en **Ejecutar de todos modos**. El instalador arranca con normalidad.

Puedes verificar el archivo de forma independiente: compara el SHA con el release de GitHub, escanéalo en VirusTotal o compila desde el código fuente. Más detalles: [guía de SmartScreen en el sitio web](https://cybergems.org/download#smartscreen).

</details>
---

## 🛠️ Stack tecnológico y arquitectura

- **Plataforma:** Windows (objetivo principal), macOS, Linux
- **Framework:** Electron 34 + React 19 + TypeScript
- **Build:** electron-vite 5 (Vite 6)
- **Estado:** Zustand 5
- **Base de datos:** better-sqlite3 (modo WAL)
- **Virtualización:** TanStack Virtual
- **Empaquetado:** electron-builder (NSIS)

```
src/
├── main/                  Proceso principal de Electron
│   ├── index.ts           Inicialización de la app, creación de ventanas
│   ├── ipc.ts             Manejadores de canales IPC
│   ├── db.ts              Capa de base de datos SQLite
│   ├── feed-parse.ts      Análisis de feeds con cadena de respaldo
│   ├── polling.ts         Orquestación del sondeo en segundo plano
│   ├── tray.ts            Bandeja del sistema, atajos, menú contextual
│   ├── notifications.ts   Ventana de notificaciones propia
│   ├── updater.ts         Ciclo de vida de las actualizaciones automáticas
│   ├── opml.ts            Importación/exportación OPML
│   └── workers/
│       ├── feed-fetcher.worker.ts      Obtención paralela de feeds
│       └── content-extractor.worker.ts Extracción de contenido de artículos
├── preload/               API puente del contexto
│   └── index.ts           Exposición de window.api
├── renderer/              Aplicación React
│   ├── notifier/          App React de la ventana de notificaciones
│   └── src/
│       ├── components/    Componentes de UI, incluida la ventana flotante de selección
│       ├── hooks/         Custom hooks de React
│       ├── store/         Stores de Zustand
│       └── styles/        CSS global y temas
└── shared/                Código compartido aislado
    ├── types.ts           Interfaces TypeScript compartidas
    ├── translations.ts    Cadenas de UI EN/ES
    ├── reddit.ts          Manejo de URL de Reddit
    └── youtube.ts         Resolución de URL y metadatos de YouTube
```

### Aspectos destacados de la arquitectura

- **Hilos worker**: la obtención de feeds y la extracción de contenido se ejecutan en workers dedicados para mantener el proceso principal receptivo
- **UI optimista**: el estado de los artículos se actualiza al instante en el renderer y luego se sincroniza con el proceso principal
- **Redimensionado por variables CSS**: el redimensionado de columnas/filas actualiza el DOM directamente durante el arrastre (cero re-renderizados de React)
- **Puente de contexto**: superficie estricta de la API de preload sin integración de Node en el renderer
- **SQLite en modo WAL**: lecturas concurrentes de alto rendimiento con escritura anticipada en el registro

### Compilar desde el código fuente (desarrolladores)

Solo necesario si quieres modificar CyberFeeds o compilarlo tú mismo; los usuarios normales pueden omitir esta sección.

#### Requisitos previos

- [Node.js](https://nodejs.org/) 18+
- [npm](https://www.npmjs.com/)

#### Desarrollo

```bash
npm install
npm run dev
```

> **Nota:** El script `postinstall` reconstruye automáticamente `better-sqlite3` para la versión actual de Electron.

#### Compilación

```bash
npm run build          # Build de producción
npm run build:win      # Instalador de Windows
npm run build:unpack   # Salida en directorio (sin instalador)
```

#### Calidad de código

```bash
npm run typecheck      # Comprobación de tipos
npm run lint           # Análisis de código
npm run format         # Formato
```
---

## ⌨️ Atajos de teclado

| Tecla | Acción | Ámbito |
|---|---|---|
| `Alt+S` | Mostrar/ocultar CyberFeeds | Global |
| `Alt+M` / `F11` | Maximizar / restaurar ventana | Aplicación |
| `Alt+F` / `F3` | Buscar texto en el artículo actual | Lector de artículos |
| `Ctrl+M` | Minimizar ventana | Aplicación |
| `Ctrl+W` | Cerrar ventana | Aplicación |
| `Intro` / `Mayús+Intro` | Coincidencia siguiente / anterior | Barra de búsqueda |
| `Escape` | Cierra el panel o la barra de búsqueda | Aplicación |

Los atajos adicionales (Notificaciones, Configuración, Obtener ahora) se configuran en Configuración → Teclado.

---

## ❤️ Donar

Tras incontables horas construyendo y perfeccionando **CyberFeeds** para mi propio uso, decidí recientemente compartirlo con el mundo junto a mis otras herramientas de código abierto en [CyberGems](https://github.com/CyberGems#-all-apps--repositories).

Si te gustaría apoyar las futuras actualizaciones, te lo agradecería de verdad. Tu donación ayuda a mantener el desarrollo, lanzar nuevas funciones, acelerar la resolución de actualizaciones y errores, y mejorar la calidad de la documentación. También puedes mostrar tu apoyo [poniendo una estrella al repo en GitHub](https://github.com/CyberGems/CyberFeeds). ¡Gracias! 🙏

<p align="center">
  <a href="https://www.paypal.com/donate/?hosted_button_id=M4PY3UPJA5Y6Q"><img src="https://img.shields.io/badge/Donar-PayPal-0070BA?style=for-the-badge&logo=paypal" alt="Donar con PayPal" /></a>
</p>

<p align="center">
  <a href="https://ko-fi.com/cybergems"><img src="https://img.shields.io/badge/Apóyame_en_Ko--fi-FF5E5B?style=for-the-badge&logo=ko-fi&logoColor=white" alt="Apóyame en Ko-fi" /></a>
</p>

<p align="center">
  <a href="https://buymeacoffee.com/cybergems"><img src="https://img.shields.io/badge/Invítame_a_un_café-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black" alt="Invítame a un café" /></a>
</p>

<div align="center">

<details>
<summary><b>Donaciones cripto (BTC, ETH, USDT, LTC): haz clic para ver las direcciones</b></summary>

| Activo | Dirección | QR |
|---|---|---|
| **BTC** | <pre><code>bc1q5mxzz05nmvsheqzx7970euswta3fksxzcfzag4</code></pre> | <img src="docs/donate/qr-btc.png" width="90" height="90" alt="QR de BTC" /> |
| **ETH** | <pre><code>0x79b703Ec0f77493679Fcd280aF3b983E20c580B8</code></pre> | <img src="docs/donate/qr-eth.png" width="90" height="90" alt="QR de ETH" /> |
| **USDT (ERC20 / BEP20)** | <pre><code>0x79b703Ec0f77493679Fcd280aF3b983E20c580B8</code></pre> | <img src="docs/donate/qr-eth.png" width="90" height="90" alt="QR de USDT" /> |
| **USDT (TRC20)** | <pre><code>TSVbSk1HSyZ1NprCnAYiw56ECwXgH887mD</code></pre> | <img src="docs/donate/qr-usdt-tron.png" width="90" height="90" alt="QR de USDT TRC20" /> |
| **LTC** | <pre><code>LWGnEHgcFCE2BRkzLnsdPDD8Y8ZeDK577X</code></pre> | <img src="docs/donate/qr-ltc.png" width="90" height="90" alt="QR de LTC" /> |

> ⚠️ Envía solo el activo seleccionado en la red indicada. Usar la red incorrecta provocará la pérdida permanente de fondos.

</details>

</div>

---

## 📄 Licencia

CyberFeeds se distribuye bajo los términos de la Licencia Pública General GNU v3.0. Consulta [LICENSE](LICENSE) para el texto completo de la licencia.

Copyright (C) 2026 CyberGems

---

## ❓ Preguntas frecuentes

Para preguntas frecuentes, guías de solución de problemas e instrucciones detalladas de configuración, visita las [Preguntas frecuentes](https://github.com/CyberGems/CyberFeeds/wiki/FAQ) o la [documentación en línea](https://cybergems.org/docs/cyberfeeds/FAQ).

---

<div align="center" style="background:#0D0F17; border:1px solid rgba(0,255,255,0.12); border-radius:12px; padding:28px 20px; margin-top:32px;">

### ¡Gracias por usar CyberFeeds! 🎉

Creado por [**CyberGems**](https://cybergems.org)

</div>
<p align="center">
  <a href="https://www.reddit.com/submit?url=https%3A%2F%2Fcybergems.org%2Fapps%2Fcyberfeeds%2F&title=CyberFeeds%3A%20herramienta%20de%20escritorio%20gratuita%20y%20de%20c%C3%B3digo%20abierto%20para%20Windows"><img src="https://img.shields.io/badge/Compartir_en_Reddit-FF4500?style=for-the-badge&logo=reddit&logoColor=white" alt="Compartir en Reddit" /></a>
  &nbsp;<a href="https://twitter.com/intent/tweet?text=CyberFeeds%3A%20herramienta%20de%20escritorio%20gratuita%20y%20de%20c%C3%B3digo%20abierto%20para%20Windows&url=https%3A%2F%2Fcybergems.org%2Fapps%2Fcyberfeeds%2F"><img src="https://img.shields.io/badge/Compartir_en_X-1DA1F2?style=for-the-badge&logo=x&logoColor=white" alt="Compartir en X" /></a>
  &nbsp;<a href="https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fcybergems.org%2Fapps%2Fcyberfeeds%2F"><img src="https://img.shields.io/badge/Compartir_en_Facebook-1877F2?style=for-the-badge&logo=facebook&logoColor=white" alt="Compartir en Facebook" /></a>
  &nbsp;<a href="mailto:?subject=CyberFeeds%3A%20herramienta%20de%20escritorio%20gratuita%20y%20de%20c%C3%B3digo%20abierto%20para%20Windows&body=CyberFeeds%3A%20herramienta%20de%20escritorio%20gratuita%20y%20de%20c%C3%B3digo%20abierto%20para%20Windows%20https%3A%2F%2Fcybergems.org%2Fapps%2Fcyberfeeds%2F"><img src="https://img.shields.io/badge/Compartir_por_Email-EA4335?style=for-the-badge&logo=gmail&logoColor=white" alt="Compartir por correo" /></a>
  &nbsp;<a href="https://t.me/share/url?url=https%3A%2F%2Fcybergems.org%2Fapps%2Fcyberfeeds%2F&text=CyberFeeds%3A%20herramienta%20de%20escritorio%20gratuita%20y%20de%20c%C3%B3digo%20abierto%20para%20Windows"><img src="https://img.shields.io/badge/Compartir_en_Telegram-26A5E4?style=for-the-badge&logo=telegram&logoColor=white" alt="Compartir en Telegram" /></a>
  &nbsp;<a href="https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fcybergems.org%2Fapps%2Fcyberfeeds%2F"><img src="https://img.shields.io/badge/Compartir_en_LinkedIn-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white" alt="Compartir en LinkedIn" /></a>
</p>

---

## 🔗 Ver también

Más aplicaciones gratuitas, de código abierto y con la privacidad primero de [**CyberGems**](https://github.com/CyberGems):

| App | Descripción |
|:---:|---|
| 🕐&nbsp;[**CyberClock**](https://github.com/CyberGems/CyberClock#readme) | Reloj de escritorio con analógico y digital, calendario, temporizador, cronómetro y módulo de relajación. |
| 🚀&nbsp;[**CyberLauncher**](https://github.com/CyberGems/CyberLauncher#readme) | Lanzador de aplicaciones de Windows con esquinas calientes, programador, monitor de sistema y terminal integrada. |
| 💻&nbsp;[**CyberManager**](https://github.com/CyberGems/CyberManager#readme) | Gestor de tareas ligero y de alto rendimiento, virtualizado y nativo de NT, una potente alternativa al Administrador de Tareas. |
| 📝&nbsp;[**CyberNotes**](https://github.com/CyberGems/CyberNotes#readme) | App de notas centrada en la privacidad con texto enriquecido, carpetas, pestañas y almacenamiento local protegido con bcrypt. |
| ⚡&nbsp;[**CyberPaste**](https://github.com/CyberGems/CyberPaste#readme) | Gestor de portapapeles con la privacidad primero para texto, código, imágenes, HTML y archivos. |
| 📸&nbsp;[**CyberSnap**](https://github.com/CyberGems/CyberSnap#readme) | Suite de captura y anotación de pantalla con herramientas vectoriales, OCR de alta velocidad, grabación de pantalla y selector de color. |
| ⭐&nbsp;[**CyberTray**](https://github.com/CyberGems/CyberTray#readme) | Lanzador de bandeja de alto rendimiento con hotspots, monitoreo de sistema, gestor de procesos y bóveda de archivos protegida con PIN. |
| 💫&nbsp;[**CyberViewer**](https://github.com/CyberGems/CyberViewer#readme) | Visor y editor de imágenes completo diseñado para usuarios casuales y avanzados. |
| 🛡️&nbsp;[**CyberWall**](https://github.com/CyberGems/CyberWall#readme) | Cortafuegos de Windows fácil de usar con reglas por aplicación en tiempo real gracias al motor kernel WFP. |

➡️ **[Todas las aplicaciones en cybergems.org](https://cybergems.org)**

## Sincronización de iconos para releases

Antes de empaquetar un release de Windows, el workflow actualiza los iconos del About desde los repositorios oficiales de CyberGems mediante una acción compartida fijada a un commit revisado. `.github/about-icons.json` define los catálogos y carpetas de esta app. Todos los PNG deben decodificarse, ser cuadrados y superar las comprobaciones de tamaño y catálogo antes de reemplazar iconos. Una fuente ausente o inválida detiene el release; el resumen muestra las URL y los hashes SHA256. El workflow **Verify About icon synchronization** comprueba la integración sin crear un release.

Con un repositorio vecino de CyberSnap, actualiza las copias antes de guardar los cambios y crear la etiqueta con `pwsh -NoProfile -File ../CyberSnap/scripts/Sync-SuiteIcons.ps1 -RepositoryRoot .`. Añade `-Check` para validar sin modificar archivos, o `-Source Local` para leer los originales de los repositorios vecinos.
