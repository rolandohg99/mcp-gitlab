# Rediseño visual y navegación — diseño (subproyecto 1 de 4)

Fecha: 2026-09-27 · Estado: aprobado en conversación, pendiente de revisión escrita
Referencia visual: maqueta aportada por el usuario (panel azul marino con menú lateral).

## Hoja de ruta

| # | Subproyecto | Estado |
|---|---|---|
| 1 | Rediseño visual y navegación (este documento) | diseño |
| 2 | Repositorios: catálogo de repos de tus productos, búsqueda y filtro por producto | pendiente |
| 3 | Reportes: horas detalladas + CSV, bugs por producto, salud de pipelines | pendiente |
| 4 | Configuración: mis productos, notificaciones, cuenta y versión | pendiente |

Cada uno tendrá su propio ciclo de spec, plan e implementación. Una opción del
menú solo aparece cuando su página existe; nunca hay botones vacíos.

## Objetivo

Que el panel se vea como la maqueta, con datos reales y sin perder nada de lo
que hace hoy: filtros y plegado de pipelines, notificaciones, cierre de sesión,
aviso de servidor caído, aviso de horas parciales y días sin registrar.

Se conservan de PRODUCT.md: WCAG 2.2 AA (texto 4.5:1, controles e indicadores
3:1, foco visible, objetivos táctiles de 44 px, `prefers-reduced-motion`),
ningún recurso externo en tiempo de ejecución, interfaz en español, solo
lectura. Solo se sirven `index.html`, `login.html`, `token.html` y `app.css`:
todo lo nuevo va incrustado en ellos. Los tres modos (escritorio, web local,
Vercel) usan los mismos archivos.

## 1. Paleta y tokens

Se sustituyen los valores de los tokens de `:root` en `public/app.css` (los
nombres se mantienen, así login y token heredan sin cambios de marcado):

| Token | Valor de partida | Uso |
|---|---|---|
| `--bg` | `#0b1220` | fondo de página |
| `--sidebar` (nuevo) | `#0d1526` | menú lateral |
| `--surface` | `#111b2e` | tarjetas |
| `--surface-2` | `#16223a` | filas en hover, campos |
| `--surface-3` | `#1c2a46` | elementos elevados, recuadro de día |
| `--border` | `rgba(148, 163, 184, 0.12)` | separadores |
| `--border-strong` | `rgba(148, 163, 184, 0.22)` | contorno de botones y tarjetas KPI |
| `--text` | `#e6edf7` | texto principal |
| `--text-muted` | `#94a3b8` | secundario |
| `--primary` | `#60a5fa` | texto, iconos y foco en acento |
| `--primary-solid` | `#3b82f6` | rellenos y borde de "hoy" |
| `--success` | `#34d399` | correcto, día completo, icono de MRs |
| `--warning` | `#fbbf24` | revisión pendiente, día parcial |
| `--danger` | `#f87171` | fallos, sin registrar, bugs |
| `--accent-violeta` (nuevo) | `#a78bfa` | To-Do, etiqueta "Reunión" |

Los valores son de partida: cada par texto/fondo usado se comprueba contra
AA con un script (se ajusta el tono hasta que pase, sin cambiar el carácter).
Los rellenos `*-soft` y `*-line` se recalculan sobre los nuevos colores.
DESIGN.md se actualiza con la paleta final.

## 2. Estructura

- **Menú lateral** (`<nav>` fijo a la izquierda): logo y "Panel de desarrollo
  Comsatel" arriba; opciones Inicio, Mis tareas y Pipelines con icono SVG
  inline; abajo, tarjeta de usuario con iniciales (sin avatar externo), nombre
  y `@usuario · Comsatel`. El rol de la maqueta no se muestra: no existe en
  GitLab.
- **Cabecera**: título "Panel de desarrollo Comsatel"; debajo, "Nombre
  (@usuario) · Productos: A · B · C". A la derecha, campana con su panel
  actual, "Actualizado a las …" y botón Refrescar con borde en acento.
  Cerrar sesión pasa a la tarjeta de usuario del menú.
- **Vistas** por hash: `#inicio` (todo), `#tareas` (issues asignados, MRs por
  revisar, mis MRs y To-Do a ancho completo), `#pipelines` (tabla a ancho
  completo). Sin hash = inicio. `hashchange` cambia la vista sin recargar
  datos; la opción activa del menú lleva `aria-current="page"`. Los KPI
  enlazan a su sección dentro de la vista que la contiene.
- **Responsive**: ≥1024 px menú completo (≈220 px); 640–1023 px menú de solo
  iconos con `aria-label` y `title` (la ventana de escritorio mínima es
  900 px); <640 px menú oculto tras un botón en la cabecera, como capa encima
  del contenido, cerrable con Escape. Sin scroll horizontal a 375 px.

## 3. Bloques

- **KPIs**: 6 tarjetas con icono en cuadro tintado, cifra, etiqueta y chevron:
  Asignados a mí (azul), Esperan mi revisión (ámbar, se tiñe solo si > 0),
  Mis MRs abiertos (verde), To-Do pendientes (violeta), **Bugs activos**
  (rojo; New, In Analysis, In Development e In Test) y **Bugs totales**
  (neutro; todos los estados). Sin cambios de backend: se calcula en el front
  con `summary.bugs[].estado`.
- **Horas registradas**: un recuadro por día con sus horas y el día de la
  semana, fecha debajo; el recuadro se tiñe por estado (completa, parcial,
  sin registrar; fines de semana sin registro en neutro) y el de hoy lleva
  borde `--primary-solid`. A la derecha: hoy, esta semana y total del rango
  con icono de reloj; selector de rango a la izquierda del título. Se
  conservan leyenda, detalle del día al pulsar, aviso de días sin registrar y
  aviso de total parcial.
- **Mis tareas**: issues asignados con referencia `#iid`, título, proyecto,
  fecha y etiquetas en chips: las etiquetas con `::` en acento azul, las demás
  en neutro. "Ver todas" lleva a la vista `#tareas`.
- **Pipelines**: tabla con cabecera Repositorio · Pipeline · columnas de
  entorno dinámicas · Actualizado; filas agrupadas por "Producto › carpeta"
  con el plegado actual; contador "N con problemas de M"; "Ver todos" lleva a
  `#pipelines`. Filtros y búsqueda se mantienen (visibles en la vista
  `#pipelines`; en inicio, solo la tabla).
- **Merge requests esperando mi revisión** y **Mis merge requests abiertos**:
  dos tarjetas bajo Mis tareas, como en la maqueta.
- **Bugs por producto** y **To-Do**: no están en la maqueta; van en inicio
  debajo de lo anterior con el mismo estilo de tarjeta.
- **Login y token**: heredan la paleta; la caja de acceso usa `--surface` y el
  botón principal `--primary-solid`.

## Manejo de errores

Se mantiene el patrón actual: cada bloque muestra su propio estado vacío o de
error ("No se pudieron leer…"), el aviso de "Algunas secciones no cargaron"
lista `summary.errors`, y el aviso de servidor caído sigue funcionando.

## Pruebas

- Script de contraste (Node, en `scripts/`) que lee los tokens de `app.css` y
  verifica los pares definidos: falla si alguno baja de 4.5:1 (texto) o 3:1
  (controles e indicadores).
- Revisión visual en el navegador con la cuenta real a 1440, 1024, 900 y
  375 px: sin scroll horizontal, menú en sus tres formas, foco visible.
- Recorrido funcional: vistas por hash y botón atrás, KPI → sección, filtros y
  plegado de pipelines, campana y marcar leídas, detalle del día en horas,
  Refrescar, cerrar sesión (web y escritorio).
- `npm test` y `tsc` siguen en verde (no hay cambios de backend).

## Fuera de alcance

Páginas Repositorios, Reportes y Configuración (subproyectos 2–4), avatar de
GitLab, colores reales de cada etiqueta, tema claro.
