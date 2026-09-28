---
name: Panel de desarrollo Comsatel
description: Panel diario del desarrollador para issues, merge requests, pipelines y horas registradas en GitLab.
colors:
  bg: "#0b1220"
  surface: "#111b2e"
  surface-2: "#16223a"
  surface-3: "#1c2a46"
  text: "#e6edf7"
  text-muted: "#94a3b8"
  border: "rgba(148, 163, 184, 0.12)"
  border-strong: "rgba(148, 163, 184, 0.22)"
  border-hover: "rgba(148, 163, 184, 0.36)"
  border-control: "#5b6b86"
  neutral-mark: "#6b7a94"
  primary: "#60a5fa"
  primary-solid: "#2563eb"
  primary-hover: "#1d4ed8"
  primary-soft: "rgba(59, 130, 246, 0.16)"
  success: "#34d399"
  success-soft: "rgba(52, 211, 153, 0.14)"
  warning: "#fbbf24"
  warning-soft: "rgba(251, 191, 36, 0.14)"
  danger: "#f87171"
  danger-solid: "#dc2626"
  danger-soft: "rgba(248, 113, 113, 0.14)"
  info: "#38bdf8"
  sidebar: "#0d1526"
  accent-violeta: "#a78bfa"
  violeta-soft: "rgba(167, 139, 250, 0.16)"
  on-solid: "#ffffff"
typography:
  title:
    fontFamily: "Segoe UI Variable Text, Segoe UI, system-ui, -apple-system, SF Pro Text, Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: "Segoe UI Variable Text, Segoe UI, system-ui, -apple-system, SF Pro Text, Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  secondary:
    fontFamily: "Segoe UI Variable Text, Segoe UI, system-ui, -apple-system, SF Pro Text, Roboto, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Segoe UI Variable Text, Segoe UI, system-ui, -apple-system, SF Pro Text, Roboto, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.5
  brand:
    fontFamily: "Segoe UI Variable Text, Segoe UI, system-ui, -apple-system, SF Pro Text, Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.25
  figure:
    fontFamily: "Segoe UI Variable Text, Segoe UI, system-ui, -apple-system, SF Pro Text, Roboto, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1
    fontFeature: "tnum"
  mono:
    fontFamily: "Cascadia Code, Consolas, SF Mono, Menlo, monospace"
    fontSize: "0.875rem"
    letterSpacing: "0.02em"
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  full: "999px"
spacing:
  space-1: "4px"
  space-2: "8px"
  space-3: "12px"
  space-4: "16px"
  space-5: "24px"
  space-6: "32px"
  space-7: "48px"
components:
  button:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    height: "36px"
    padding: "0 12px"
  button-hover:
    backgroundColor: "{colors.surface-3}"
  button-primary:
    backgroundColor: "{colors.primary-solid}"
    textColor: "{colors.on-solid}"
    rounded: "{rounded.sm}"
    height: "36px"
    padding: "0 12px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.on-solid}"
  button-small:
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    height: "30px"
    padding: "0 12px"
  field:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    height: "36px"
    padding: "0 12px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
  list-item-hover:
    backgroundColor: "{colors.surface-2}"
  badge:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text-muted}"
    typography: "{typography.label}"
    rounded: "{rounded.xs}"
    height: "20px"
    padding: "0 6px"
  badge-danger:
    backgroundColor: "{colors.danger-soft}"
    textColor: "{colors.danger}"
    rounded: "{rounded.xs}"
  kpi:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-muted}"
    typography: "{typography.secondary}"
    height: "56px"
    padding: "8px 16px"
  popover:
    backgroundColor: "{colors.surface-2}"
    rounded: "{rounded.md}"
    width: "400px"
  unread-badge:
    backgroundColor: "{colors.danger-solid}"
    textColor: "{colors.on-solid}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    height: "18px"
---

# Design System: Panel de desarrollo Comsatel

## Overview

**Creative North Star: "La sala de guardia"**

Un panel azul marino que se consulta muchas veces al día, en el puesto de trabajo.
Al abrirlo, el desarrollador sabe en segundos qué está roto, qué espera su
revisión y si su registro de horas está al día. La interfaz se retira y deja
hablar a los datos: una sola fuente del sistema, capas planas separadas por
tono y un color que solo aparece cuando algo pide atención.

Es una interfaz de trabajo (modo Operate): se prefiere lo familiar a lo
sorprendente, la densidad a los espacios vacíos y la consistencia a la
expresión. Una misma hoja, `public/app.css`, sirve a las tres pantallas (panel,
login OAuth y conexión por token), y ningún recurso sale de fuera del proyecto.

**Key Characteristics:**
- Tema oscuro único (`color-scheme: dark`), en azul marino con bordes azulados.
- Menú lateral fijo y vistas por hash (`#inicio`, `#tareas`, `#pipelines`).
- Lo sano en silencio: neutro para lo correcto, color solo para fallo,
  pendiente o sin registrar. Los iconos de las lecturas sí llevan su color
  identificativo; las cifras no.
- Profundidad plana: tonos y bordes finos; una única sombra para lo que flota.
- Fuente del sistema con cifras tabulares en todo número que se compara.
- 36px de control con ratón, 44px con dedo.
- Contrastes calculados, no estimados.

## Colors

Azules marino en cinco tonos (con el del menú), un acento azul partido en texto
y relleno, cuatro colores de estado y un violeta para To-Do. Todos los pares se
comprueban con `node scripts/contraste.mjs` (también dentro de `npm test`).

### Primary
- **Azul señal** (`primary`, `#60a5fa`): enlaces, iconos de título, anillo de
  foco, opción activa del menú y "Ver todas". ≥ 4.5:1 sobre `surface` y `surface-2`.
- **Azul sólido** (`primary-solid`, `#2563eb`; hover `#1d4ed8`): relleno del
  botón primario y borde del día de hoy. Blanco encima 5.17:1. `#3b82f6`, el
  azul de la maqueta, se descartó como relleno: el blanco encima solo da 3.68:1.

### Neutral
- **Noche** (`bg`, `#0b1220`): lienzo y cabecera.
- **Menú** (`sidebar`, `#0d1526`): barra lateral.
- **Marino** (`surface`, `#111b2e`): tarjetas, KPIs y cajas de acceso.
- **Marino elevado** (`surface-2`): hover de filas, campos y panel de avisos.
- **Marino de paso** (`surface-3`): recuadros de horas, avatar y contadores.
- **Hielo** (`text`, `#e6edf7`) y **pizarra** (`text-muted`, `#94a3b8`).
- **Reposo** (`neutral-mark`): puntos de estado sano y separadores `·`.
- **Bordes** (`border`, `border-strong`, `border-hover`): azul pizarra
  translúcido, nunca blanco.

### Estados
- **Verde** (`success`): pipeline o despliegue correcto, icono de "Mis MRs",
  filo de la jornada completa.
- **Ámbar** (`warning`): en curso, jornada parcial, MRs que esperan tu revisión.
- **Rojo** (`danger`): fallo, conflicto, laborable sin registrar, bugs.
- **Violeta** (`accent-violeta`): To-Do pendientes.
- **Cian** (`info`): iconos de despliegue y actualización en los avisos.

### Named Rules
**La regla del silencio.** Lo que está bien no se tiñe: la jornada completa es
un recuadro neutro con un filo verde, no un bloque verde.

**La regla del acento partido.** El azul claro es para texto; el sólido, para
relleno. Nunca se intercambian.

**La regla del contraste medido.** Un token nuevo o cambiado entra en `PARES` de
`scripts/contraste.mjs`; si el script falla, el tono se ajusta.

## Typography

**Display Font:** la del sistema (Segoe UI Variable en Windows, SF Pro en macOS)
**Body Font:** la del sistema
**Label/Mono Font:** Cascadia Code (con Consolas, SF Mono, Menlo), solo para el token

**Character:** la sans nativa del sistema operativo, sin descargas: el panel se
siente parte del escritorio y carga sin esperar fuentes.

### Hierarchy
- **Cifra** (600, 1.25rem, 1, `tnum`): lecturas del resumen y totales de horas.
- **Marca** (600, 1rem): nombre del panel en la barra superior.
- **Título** (600, 0.875rem): títulos de tarjeta y de sección.
- **Cuerpo** (400 o 500, 0.875rem, 1.5): títulos de fila en 500 y texto base en 400.
- **Secundario** (400, 0.8125rem): nombre de usuario, etiquetas del resumen,
  notas de acceso y títulos de aviso.
- **Etiqueta** (500, 0.75rem): metadatos, chips, leyenda, días del gráfico.

### Named Rules
**La regla de las cifras quietas.** Todo número que se actualiza o se compara en
columna usa `tabular-nums`: contadores, horas, fechas y referencias `#1511` / `!233`.

**La regla de una sola familia.** Ninguna fuente web. El monoespaciado existe
solo para el token, que es un dato literal.

## Layout

Menú lateral fijo de 232px y contenido de hasta 1600px con márgenes de 24px
(12px en móvil). La cabecera es fija: título, subtítulo con usuario y
productos, campana, hora de actualización y Refrescar con borde azul.

- **Menú:** ≥ 1024px completo; 640–1023px solo iconos (72px, con `title` y nombre
  accesible), incluida la ventana mínima de escritorio (900px); < 640px oculto
  tras un botón, como capa sobre el contenido que se cierra con Escape o
  tocando fuera, devolviendo el foco al botón.
- **Vistas:** `#inicio` muestra todo; `#tareas`, issues, MRs y To-Do a ancho
  completo; `#pipelines`, la tabla completa con filtros. Un hash desconocido es
  inicio.
- **KPIs:** seis tarjetas (6 → 3 → 2 columnas por debajo de 1280px y 720px).
- **Tablero de inicio (≥ 1100px):** Mis tareas y los dos MRs a la izquierda
  (2fr), pipelines a la derecha (3fr); bugs y To-Do debajo. Por debajo de
  1100px, una columna.
- **Pipelines:** la disposición responde al ancho de la tarjeta (container
  query), no de la ventana. En inicio, 760px de alto con scroll interno.
- **Ritmo:** escala de 4px; 16px entre bloques.

## Elevation & Depth

Plana por tonos. Las capas se ordenan `bg` → `surface` → `surface-2` →
`surface-3`, separadas por bordes de blanco translúcido. No hay resplandores,
brillos interiores ni halos de color.

### Shadow Vocabulary
- **Flotante** (`box-shadow: 0 12px 32px rgba(0,0,0,0.55), 0 2px 6px rgba(0,0,0,0.4)`):
  solo el panel de notificaciones.

### Named Rules
**La regla de la capa plana.** Solo lleva sombra lo que flota sobre el contenido.
Una tarjeta con sombra es una tarjeta que finge flotar.

## Shapes

4px en chips y código; 8px en botones, campos, iconos de KPI y recuadros de
horas; 12px en tarjetas, KPIs, cajas de acceso y panel de avisos. Píldora para
contadores, avatar y puntos. El laborable sin registrar lleva contorno rojo
discontinuo.

## Components

### Buttons
- **Shape:** 6px, 36px de alto (44px con puntero táctil).
- **Default:** grafito elevado, borde `border-strong`, texto en 500.
- **Hover / Focus:** fondo `surface-3` y borde `border-hover` en 120ms; foco
  con anillo índigo de 2px separado 2px.
- **Primary:** relleno `primary-solid`, blanco, sin sombra; el hover oscurece a
  `primary-hover`.
- **Icon:** cuadrado del alto de control.
- **Block:** ancho completo y 44px para la acción principal de login y token.
- **Disabled:** 45% de opacidad (exento de contraste por WCAG).

### Chips
- **Neutro:** 4px, 20px de alto, fondo grafito, texto ceniza.
- **Scope** (etiquetas con `::`): índigo translúcido.
- **Conflictos / fallo:** rojo translúcido con borde rojo al 45%.
- **Despliegue por entorno:** chip neutro con punto de estado; solo el fallido se tiñe.

### Estado de pipeline
- Punto de 6px más texto en español ("correcto", "falló", "en curso",
  "pendiente", "cancelado", "manual"). Correcto en ceniza con punto verde; fallo
  en rojo; en curso y pendiente en ámbar; el resto en ceniza con punto gris.

### Matriz de pipelines
- **Celda de entorno:** un icono de 14px cuya forma dice el estado: ✓ correcto,
  ✕ falló, reloj en curso o en espera, triángulo manual, raya cancelado u omitido,
  y un punto tenue si no hay despliegue. Solo el fallo (rojo) y el curso (ámbar)
  llevan color. Cada celda tiene nombre accesible ("qa: correcto").
- **Carpeta:** botón de 40px con chevron que gira, nombre, número de
  repositorios, problemas en rojo si los hay y fecha más reciente. El estado
  plegado se recuerda en el navegador. Con filtro o búsqueda activos, todas se
  abren.
- **Filtro:** control segmentado (Todos, Con problemas, En curso) con
  contadores; el de problemas en rojo y el de curso en ámbar cuando no son cero.
  Al lado, búsqueda por repositorio, carpeta o rama.
- **Fila:** nombre enlazado al pipeline, rama en monoespaciada y, si falló,
  hasta dos jobs fallidos en rojo ("y N más").

### Cards / Containers
- **Corner Style:** 12px.
- **Background:** `surface`; cabecera de 48px separada por un borde.
- **Shadow Strategy:** ninguna (ver Elevation & Depth).
- **Internal Padding:** filas de 12px por 16px.

### Inputs / Fields
- **Style:** grafito elevado, borde `border-control`, 6px, 36px (44px en login y token).
- **Focus:** borde índigo más anillo de foco; en hover el borde pasa a ceniza.
- **Placeholder:** ceniza.

### Navigation
- **Menú lateral:** logo `</>` en cuadro azul translúcido, nombre, opciones con
  icono (la activa, fondo azul translúcido y `aria-current="page"`) y tarjeta de
  usuario con iniciales, nombre, `@usuario · Comsatel` y cerrar sesión.
- **KPIs:** icono de 40px en cuadro tintado de su color, cifra, etiqueta y
  chevron; enlazan a su vista o sección. Solo "Esperan mi revisión" tiñe la
  cifra, y solo si es mayor que cero.
- **Tarjetas:** título con icono azul, contador en píldora y "Ver todas" hacia
  la vista completa (oculto dentro de esa vista).

### Estados de carga, vacío y error
- **Esqueleto:** líneas con brillo de 1.4s (estático con movimiento reducido).
- **Vacío:** título en tiza más una frase que explica qué aparecerá ahí.
- **Error:** dice qué falló y cómo recuperarse ("Pulsa Refrescar para reintentar").

### Gráfico de horas
- Un recuadro de 72px por día con sus horas y el día de la semana, y la fecha
  debajo. Completa: neutro con filo verde inferior; parcial: ámbar translúcido;
  laborable sin registrar: contorno rojo discontinuo con un "0" rojo; fin de
  semana sin horas: hueco. Hoy lleva borde `primary-solid` de 2px; el
  seleccionado, anillo `primary`. Totales a la derecha con icono de reloj.

### Panel de avisos
- Popover de 400px (fijo a lo ancho en móvil) con sombra flotante y entrada de
  180ms. Los no leídos llevan fondo índigo translúcido y un punto índigo; cada
  tipo tiene su icono. "Marcar todas como leídas" se deshabilita cuando no queda
  ninguno sin leer.

## Do's and Don'ts

### Do:
- **Do** reservar `success` para puntos de 6px; el estado sano se lee en ceniza.
- **Do** usar `primary` (#60a5fa) para texto y `primary-solid` (#2563eb) solo como relleno.
- **Do** atenuar con `text-muted`, nunca con `opacity`.
- **Do** calcular el contraste de cada pareja nueva de texto y fondo (4.5:1 texto, 3:1 controles).
- **Do** mantener 44px de control con puntero táctil.
- **Do** aplicar `tabular-nums` a contadores, horas, fechas y referencias.
- **Do** acompañar el color con texto o forma: "0" y contorno discontinuo, "falló", punto más palabra.
- **Do** incrustar todo recurso nuevo (iconos SVG en el sprite de `index.html`).

### Don't:
- **Don't** anidar tarjetas: una sección que agrupa tarjetas no lleva marco.
- **Don't** usar sombras de color, resplandores o brillos interiores.
- **Don't** cargar fuentes, iconos o imágenes desde servidores externos.
- **Don't** usar `columns` para agrupar pipelines: deja filas inalcanzables.
- **Don't** pintar de verde superficies grandes para indicar que todo va bien.
- **Don't** usar rayados ni texturas decorativas.
- **Don't** usar negro puro (#000) de fondo.
