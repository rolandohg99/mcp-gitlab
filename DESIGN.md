---
name: Panel de desarrollo SIGO
description: Panel diario del desarrollador para issues, merge requests, pipelines y horas registradas en GitLab.
colors:
  bg: "#09090b"
  surface: "#111114"
  surface-2: "#18181c"
  surface-3: "#1f1f24"
  text: "#ededef"
  text-muted: "#9095a0"
  border: "rgba(255, 255, 255, 0.07)"
  border-strong: "rgba(255, 255, 255, 0.12)"
  border-hover: "rgba(255, 255, 255, 0.22)"
  border-control: "#6b7080"
  neutral-mark: "#767b88"
  primary: "#8b95f0"
  primary-solid: "#5663cc"
  primary-hover: "#4f5bc4"
  primary-soft: "rgba(94, 106, 210, 0.14)"
  success: "#3fd68c"
  success-soft: "rgba(63, 214, 140, 0.12)"
  warning: "#f5b544"
  warning-soft: "rgba(245, 181, 68, 0.12)"
  danger: "#ff6b6b"
  danger-solid: "#c93434"
  danger-soft: "rgba(255, 107, 107, 0.12)"
  info: "#4fc3f7"
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

# Design System: Panel de desarrollo SIGO

## Overview

**Creative North Star: "La torre de control"**

Un panel oscuro que se consulta muchas veces al día, en el puesto de trabajo.
Al abrirlo, el desarrollador sabe en segundos qué está roto, qué espera su
revisión y si su registro de horas está al día. La interfaz se retira y deja
hablar a los datos: una sola fuente del sistema, capas planas separadas por
tono y un color que solo aparece cuando algo pide atención.

Es una interfaz de trabajo (modo Operate): se prefiere lo familiar a lo
sorprendente, la densidad a los espacios vacíos y la consistencia a la
expresión. Una misma hoja, `public/app.css`, sirve a las tres pantallas (panel,
login OAuth y conexión por token), y ningún recurso sale de fuera del proyecto.

**Key Characteristics:**
- Tema oscuro único (`color-scheme: dark`).
- Lo sano en silencio: gris neutro para lo correcto, color solo para fallo,
  pendiente o sin registrar.
- Profundidad plana: tonos y bordes finos; una única sombra para lo que flota.
- Fuente del sistema con cifras tabulares en todo número que se compara.
- 36px de control con ratón, 44px con dedo.
- Contrastes calculados, no estimados.

## Colors

Neutros casi negros en cuatro tonos, un gris de reposo, un acento índigo partido
en texto y relleno, y cuatro colores de estado con su variante translúcida.

### Primary
- **Índigo señal** (`primary`): enlaces, iconos, anillo de foco, día de hoy y
  marca. 6.5:1 sobre `surface-2`.
- **Índigo sólido** (`primary-solid`, `primary-hover`): solo como relleno del
  botón primario; blanco encima 5.2:1 y 5.8:1. El hover oscurece, no aclara.

### Neutral
- **Negro de fondo** (`bg`): lienzo y barra superior.
- **Grafito** (`surface`): tarjetas, tira de resumen y cajas de acceso.
- **Grafito elevado** (`surface-2`): botones, campos, panel de avisos y hover de filas.
- **Grafito de paso** (`surface-3`): hover de botones y de filas dentro del panel de avisos.
- **Tiza** (`text`): texto principal, 17.0:1 sobre `bg`.
- **Ceniza** (`text-muted`): metadatos, etiquetas, contadores; 6.3:1 sobre
  `surface` y 5.5:1 en la capa más clara.
- **Gris de reposo** (`neutral-mark`): barras de jornada completa, barras de
  bugs, puntos de estado sano y separadores `·`. 4.2:1 sobre `surface-2`.
- **Límite de campo** (`border-control`): contorno de inputs y selects, 3.6:1 o más.
- **Bordes de vidrio** (`border`, `border-strong`, `border-hover`): separadores
  y contornos de botones.

### Estados
- **Verde operativo** (`success`): solo el punto de un pipeline o despliegue
  correcto y el icono de avisos de MR. Nunca rellena superficies grandes.
- **Ámbar pendiente** (`warning`): en curso, jornada parcial, revisiones que te
  esperan, aviso de días sin registrar.
- **Rojo incidencia** (`danger`, `danger-solid`): fallo, conflicto, día
  laborable sin registrar, contador de avisos sin leer.
- **Cian aviso** (`info`): iconos de To-Do, despliegue y actualización.

### Named Rules
**La regla del silencio.** Lo que está bien no se tiñe. Un pipeline correcto se
lee en ceniza con un punto verde de 6px; uno roto, en rojo. Si una pantalla sana
se ve colorida, algo está mal diseñado.

**La regla del acento partido.** El índigo claro es para texto; el sólido es para
relleno. Nunca se intercambian.

**La regla sin opacidad.** Para atenuar texto se cambia su color, nunca su
opacidad: con opacidad el contraste cae por debajo de 3:1.

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

Columna central de hasta 1560px con márgenes laterales de 24px (12px en móvil).
La barra superior es fija, de 56px y siempre en una sola fila.

- **Resumen:** una sola tira con separadores de 1px, columnas de 150px como
  mínimo (cinco en escritorio, dos en móvil). Cada lectura enlaza a su sección.
- **Horas:** tarjeta de ancho completo; barras de 40px de ancho mínimo en una
  tira con scroll horizontal y el detalle del día debajo (220px con scroll).
- **Listas:** rejilla automática de 380px como mínimo; cuerpo con scroll interno
  de 420px (340px en móvil) y `overscroll-behavior: contain`.
- **Pipelines:** una sola tarjeta con una matriz: una fila por repositorio,
  agrupadas en carpetas plegables, sin scroll interno. Columnas: repositorio
  (hasta 440px), pipeline (104px), una columna de 52px por entorno en orden de
  promoción (dev, qa, pre, prod) y fecha (96px). El ancho sobrante va a una
  pista vacía al final. La cabecera de columnas queda fija bajo la barra
  superior. Por debajo de 760px cada fila pasa a dos líneas con chips de entorno
  etiquetados. Nunca `columns`.
- **Puntos de corte:** 1100px oculta la hora de actualización; 900px oculta el
  usuario y deja refrescar y cerrar sesión como botones de solo icono (conservan
  su nombre accesible); 720px compacta márgenes y fija el panel de avisos a lo
  ancho; 400px reduce la marca.
- **Ritmo:** escala de 4px. Separación de 16px entre bloques y de 12px entre las
  tarjetas de carpeta.

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

Radios contenidos: 4px en chips, código, barras y muestras; 6px en botones y
campos; 8px en tarjetas, tira de resumen, cajas de acceso y panel de avisos.
Píldora completa solo para el contador de no leídos y los puntos de estado. Los
días laborables sin registrar llevan contorno discontinuo rojo.

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
- **Corner Style:** 8px.
- **Background:** `surface`; cabecera de 48px separada por un borde.
- **Shadow Strategy:** ninguna (ver Elevation & Depth).
- **Internal Padding:** filas de 12px por 16px.

### Inputs / Fields
- **Style:** grafito elevado, borde `border-control`, 6px, 36px (44px en login y token).
- **Focus:** borde índigo más anillo de foco; en hover el borde pasa a ceniza.
- **Placeholder:** ceniza.

### Navigation
- **Barra superior:** marca SVG propia (cuadro con tres barras), título, usuario,
  hora de actualización, campana con contador, refrescar y cerrar sesión.
- **Resumen:** enlaces de ancla a cada sección, con `scroll-margin-top` para no
  quedar debajo de la barra fija. La lectura que pide acción lleva cifra ámbar y
  un punto ámbar.

### Estados de carga, vacío y error
- **Esqueleto:** líneas con brillo de 1.4s (estático con movimiento reducido).
- **Vacío:** título en tiza más una frase que explica qué aparecerá ahí.
- **Error:** dice qué falló y cómo recuperarse ("Pulsa Refrescar para reintentar").

### Gráfico de horas
- Barra por día: gris de reposo si la jornada está completa (9h), ámbar si es
  parcial, contorno discontinuo rojo con un "0" rojo si es laborable sin
  registrar, y columna vacía en fin de semana. El día seleccionado lleva contorno
  índigo y el de hoy, su etiqueta en índigo.

### Panel de avisos
- Popover de 400px (fijo a lo ancho en móvil) con sombra flotante y entrada de
  180ms. Los no leídos llevan fondo índigo translúcido y un punto índigo; cada
  tipo tiene su icono. "Marcar todas como leídas" se deshabilita cuando no queda
  ninguno sin leer.

## Do's and Don'ts

### Do:
- **Do** reservar `success` para puntos de 6px; el estado sano se lee en ceniza.
- **Do** usar `primary` (#8b95f0) para texto y `primary-solid` (#5663cc) solo como relleno.
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
