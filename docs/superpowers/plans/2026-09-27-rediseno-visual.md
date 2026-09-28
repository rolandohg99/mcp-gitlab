# Rediseño visual y navegación — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir el panel a la maqueta azul marino con menú lateral y vistas, con datos reales y sin perder ninguna función actual.

**Architecture:** Solo front: los tokens de `public/app.css` cambian de valor (login y token heredan), `public/index.html` gana un menú lateral, cabecera nueva y vistas por hash (`#inicio`, `#tareas`, `#pipelines`) que muestran u ocultan secciones ya existentes. Un script de Node verifica el contraste AA de los tokens.

**Tech Stack:** HTML/CSS/JS sin dependencias (incrustado en `index.html`), Node 24 `node:test` para el script de contraste. Para las decisiones visuales de detalle, usar el skill `impeccable` del proyecto (DESIGN.md y PRODUCT.md son su contexto).

**Spec:** `docs/superpowers/specs/2026-09-27-rediseno-visual-design.md`

## Global Constraints

- Tokens de partida (spec §1): `--bg #0b1220`, `--sidebar #0d1526` (nuevo), `--surface #111b2e`, `--surface-2 #16223a`, `--surface-3 #1c2a46`, `--border rgba(148,163,184,0.12)`, `--border-strong rgba(148,163,184,0.22)`, `--text #e6edf7`, `--text-muted #94a3b8`, `--primary #60a5fa`, `--primary-solid #3b82f6`, `--success #34d399`, `--warning #fbbf24`, `--danger #f87171`, `--accent-violeta #a78bfa` (nuevo). Se ajustan solo si el script de contraste lo exige.
- AA: texto ≥ 4.5:1, controles e indicadores ≥ 3:1, foco visible, objetivos táctiles de 44 px, `prefers-reduced-motion` respetado.
- Ningún recurso externo (fuentes, iconos, imágenes): iconos como `<symbol>` en el sprite de `index.html`. Los servidores solo sirven `index.html`, `login.html`, `token.html` y `app.css`.
- Sin cambios de backend ni de rutas `/api/*`. `cargar` sigue siendo global: la app de escritorio la invoca con `executeJavaScript("typeof cargar === 'function' && cargar()")`.
- Todo texto que venga de GitLab pasa por `esc()`; la cabecera de productos usa `textContent`.
- Claves de `localStorage` existentes (`panel-sigo:*`) no se renombran.
- Menú: ≥1024 px completo (~220 px); 640–1023 px solo iconos (con `aria-label` y `title`); <640 px oculto tras botón, capa cerrable con Escape. Sin scroll horizontal a 375 px.
- Tras cada tarea: `npm test` en verde y revisión en el navegador con la cuenta real (config `dashboard` de `.claude/launch.json`, puerto 5188, `TIMELOG_GROUP` vacío).

## Review Focus

1. **Hash desconocido o vacío** (`#foo`, `#`) → vista inicio, nunca una página en blanco (Task 2).
2. **Ventana de escritorio de 900 px** → menú de iconos, sin scroll horizontal, y la recarga desde Electron (`cargar()`) sigue funcionando (Task 2 y Task 6).
3. **Menú móvil con teclado** → Escape cierra, el foco vuelve al botón que lo abrió y la opción activa se anuncia con `aria-current` (Task 2).
4. **Textos largos** (nombre de repo, rama, etiqueta, título de issue) → se recortan con elipsis dentro de su celda; nunca empujan la página a lo ancho (Task 5).
5. **Bloques vacíos o con error** (sin productos, sin bugs, GitLab caído) → cada bloque muestra su estado vacío/error legible con la paleta nueva (Task 5).

---

### Task 1: Paleta nueva y verificación de contraste

**Files:**
- Create: `scripts/contraste.mjs`
- Create: `scripts/contraste.test.mjs`
- Modify: `public/app.css` (valores de `:root`, `*-soft`, `*-line`, `--neutral-mark`, cabecera del archivo)
- Modify: `package.json` (script `test`)

**Interfaces:**
- Produces:
  - `export function ratio(hexA: string, hexB: string): number` — contraste WCAG entre dos `#rrggbb`.
  - `export function leerTokens(css: string): Record<string, string>` — pares `--nombre: #hex` del primer bloque `:root` (ignora valores no hex).
  - `export const PARES: Array<{ texto: string; fondo: string; minimo: 4.5 | 3 }>` — tokens a comprobar: `--text` y `--text-muted` sobre `--bg`, `--sidebar`, `--surface`, `--surface-2`, `--surface-3` (4.5); `--primary`, `--success`, `--warning`, `--danger`, `--accent-violeta` sobre `--surface` y `--surface-2` (4.5); `--primary-solid` como borde sobre `--surface` (3); blanco `#ffffff` sobre `--primary-solid` (4.5).
  - `export function verificar(css: string): string[]` — mensajes de los pares que no cumplen; vacío si todo pasa.
  - CLI: `node scripts/contraste.mjs` imprime cada par con su ratio y sale con código 1 si hay fallos.

- [ ] **Step 1: Test que falla** en `scripts/contraste.test.mjs`: `ratio("#000000", "#ffffff")` ≈ 21 (±0.01); `ratio("#ffffff", "#ffffff")` = 1; `leerTokens(":root { --bg: #0b1220; --x: rgba(0,0,0,1); }")` → `{ "--bg": "#0b1220" }`; `verificar(readFileSync("public/app.css"))` → `[]` y `leerTokens(...)["--bg"] === "#0b1220"` (este último falla hasta cambiar la paleta).
- [ ] **Step 2: Cambiar el script de test** a `npm run build && node --test "dist/**/*.test.js" "scripts/*.test.mjs"` (con `npm pkg set`, el archivo tiene CRLF). Run: `npm test` → Expected: FAIL (no existe `contraste.mjs`).
- [ ] **Step 3: Implementar `scripts/contraste.mjs`** (luminancia relativa WCAG 2.x).
- [ ] **Step 4: Aplicar la paleta** de Global Constraints en `app.css`; añadir `--sidebar` y `--accent-violeta`; recalcular `*-soft` (mismo color al 12–14 %) y `--neutral-mark` (≥ 3:1 sobre `--surface-2`). Run: `node scripts/contraste.mjs` → ajustar tonos hasta salida 0. Run: `npm test` → PASS.
- [ ] **Step 5: Verificar** en el navegador que login, token e inicio ya se ven en azul marino sin texto ilegible.
- [ ] **Step 6: Commit** — `feat: paleta azul marino con verificación de contraste`

---

### Task 2: Menú lateral, cabecera y vistas

**Files:** Modify: `public/index.html`

**Interfaces:**
- Produces:
  - Marcado: `<nav class="menu" id="menu" aria-label="Principal">` con enlaces `href="#inicio"`, `#tareas`, `#pipelines` (clase `menu-item`, icono + `<span class="menu-texto">`), tarjeta `.menu-usuario` con `#iniciales`, `#usuario-nombre`, `#usuario-alias` y el botón `#salir` (movido desde la cabecera). Botón `#abrir-menu` en la cabecera (solo visible < 640 px).
  - Cabecera: `h1` "Panel de desarrollo Comsatel", línea `#subtitulo` = "Nombre (@usuario) · Productos: …" (sustituye a `#who` y `#productos`), campana, `#stamp`, `#refresh`.
  - Cada sección de `main` lleva `data-vistas="inicio tareas"` / `"inicio pipelines"` / `"inicio"`.
  - `function aplicarVista(): void` — lee `location.hash`, normaliza a `inicio|tareas|pipelines` (cualquier otro → `inicio`), oculta con `hidden` las secciones cuya `data-vistas` no la incluye, marca `aria-current="page"` en su enlace, cierra el menú móvil. Se llama al cargar y en `hashchange`.
  - `function iniciales(nombre: string): string` — primeras letras de las dos primeras palabras, mayúsculas; `"?"` si vacío.

- [ ] **Step 1: Maquetar** menú, cabecera y layout (grid `menu | contenido`), con los tres tamaños de la Global Constraint y el sprite con los iconos nuevos (`i-inicio`, `i-tareas`, `i-menu`).
- [ ] **Step 2: Implementar** `aplicarVista`, `iniciales`, apertura/cierre del menú móvil (Escape y clic fuera cierran; el foco vuelve a `#abrir-menu`), y rellenar usuario/subtítulo en `cargar()`. `#salir` conserva su manejador actual.
- [ ] **Step 3: Verificar en el navegador** (cuenta real) con `javascript_tool`:
  - `location.hash = "#pipelines"` → solo la sección de pipelines visible y `document.querySelector('[aria-current="page"]').getAttribute("href") === "#pipelines"`; `history.back()` vuelve a la vista anterior.
  - `location.hash = "#foo"` → vista inicio.
  - A 1440 px menú completo; a 900 px solo iconos; a 375 px menú oculto, `#abrir-menu` lo abre, Escape lo cierra y `document.activeElement.id === "abrir-menu"`; en los tres, `document.documentElement.scrollWidth <= innerWidth`.
  - `typeof cargar === "function"`.
- [ ] **Step 4: Commit** — `feat: menú lateral, cabecera y vistas por hash`

---

### Task 3: KPIs con icono y bugs activos/totales

**Files:** Modify: `public/index.html` (`pintarKpis`, estilos `.kpi`, sprite)

**Interfaces:**
- Consumes: `summary.bugs[]` con `estado` en `New | In Analysis | In Development | In Test | Done | Deployed`.
- Produces: `const ESTADOS_ACTIVOS = ["New", "In Analysis", "In Development", "In Test"]`; seis tarjetas en este orden: Asignados a mí (`--primary`, → `#tareas`), Esperan mi revisión (`--warning`, tinte solo si > 0, → `#tareas`), Mis MRs abiertos (`--success`, → `#tareas`), To-Do pendientes (`--accent-violeta`, → `#tareas`), Bugs activos (`--danger`, → sección de bugs en inicio), Bugs totales (neutro, → sección de bugs en inicio).

- [ ] **Step 1: Implementar** tarjeta con cuadro de icono tintado (color al 14 %), cifra, etiqueta y chevron; rejilla de 6 → 3 → 2 columnas según ancho.
- [ ] **Step 2: Verificar** con la cuenta real: la suma de `.kpi-n` de "Bugs totales" es igual a `s.bugs.reduce((a,b)=>a+b.total,0)` y "Bugs activos" a la suma filtrada por `ESTADOS_ACTIVOS` (comparar desde `javascript_tool` pidiendo `/api/summary`).
- [ ] **Step 3: Commit** — `feat: KPIs con icono y bugs activos/totales`

---

### Task 4: Horas en recuadros por día

**Files:** Modify: `public/index.html` (`pintarHoras`, estilos `.dias`/`.dia`, leyenda, cabecera de la tarjeta)

**Interfaces:**
- Consumes: informe de `/api/timelogs` (`dias[]`, `hasta`, `horasHoy`, `horasSemana`, `totalHoras`, `parcial`, `diasLaborablesSinRegistro`).
- Produces: cada `.dia` es un `<button>` con horas y día de la semana dentro y la fecha debajo; clases de estado `dia-completo` (≥ 9 h, `--success`), `dia-parcial` (> 0 h, `--warning`), `dia-vacio` (laborable sin horas, `--danger`), `dia-libre` (fin de semana sin horas, neutro); `dia-hoy` (`d.fecha === r.hasta`) con borde `--primary-solid`. Totales a la derecha con icono de reloj.

- [ ] **Step 1: Implementar** conservando `aria-pressed`, el detalle del día al pulsar, el aviso de días sin registrar y el aviso de total parcial.
- [ ] **Step 2: Verificar** con la cuenta real (14 y 90 días): hay exactamente un `.dia-hoy`; un día con 9 h tiene `dia-completo`; pulsar un día muestra su detalle; a 375 px los recuadros se desplazan dentro de su tarjeta sin scroll de página.
- [ ] **Step 3: Commit** — `feat: horas registradas en recuadros por día`

---

### Task 5: Mis tareas, pipelines en tabla, MRs, bugs y To-Do

**Files:** Modify: `public/index.html` (`pintarIssues`, `tags`, `pintarMrs`, `pintarPipelines`, `filaPipeline`, `pintarBugs`, `pintarTodos`, disposición de la rejilla)

**Interfaces:**
- Produces:
  - Disposición de inicio (≥ 1100 px): fila 1 Mis tareas (izquierda, ~40 %) + Pipelines (derecha); fila 2 las dos tarjetas de MRs bajo Mis tareas; después Bugs por producto y To-Do. En `#tareas` y `#pipelines` las secciones ocupan el ancho completo.
  - `tags()`: chip con `::` → clase `chip-scope` (acento azul); resto → `chip` neutro.
  - Tarjeta Mis tareas con contador y enlace "Ver todas" → `#tareas`; tarjeta Pipelines con "N con problemas de M" y "Ver todos" → `#pipelines`. Filtros y búsqueda de pipelines visibles solo en la vista `#pipelines`.

- [ ] **Step 1: Implementar** los cambios de marcado y estilo; celdas de texto con `min-width: 0` y elipsis.
- [ ] **Step 2: Verificar** con la cuenta real: los issues muestran chips `chip-scope` para etiquetas con `::`; la tabla conserva agrupación "Producto › carpeta", plegado y filtros (en `#pipelines`); con `DASHBOARD_PRODUCTS=noexiste` en `.claude/launch.json` el bloque de pipelines muestra "No detectamos productos…" legible; a 375 px ningún texto largo provoca scroll horizontal.
- [ ] **Step 3: Commit** — `feat: tareas, pipelines, MRs, bugs y To-Do con el diseño nuevo`

---

### Task 6: Acceso, documentación y recorrido final

**Files:** Modify: `public/login.html`, `public/token.html` (solo si algo no hereda bien), `DESIGN.md`

- [ ] **Step 1: Login y token**: caja en `--surface`, botón principal `--primary-solid`; revisar en el navegador con el servidor estático (`public-estatico`).
- [ ] **Step 2: DESIGN.md**: actualizar el bloque `colors` y la sección de paleta con los valores finales de `app.css`, y describir menú lateral y vistas.
- [ ] **Step 3: Recorrido final** con la cuenta real a 1440, 1024, 900 y 375 px: vistas y atrás, KPI → sección, filtros y plegado, campana y marcar leídas, detalle de día, Refrescar, aviso "Algunas secciones no cargaron" (forzado con `DASHBOARD_PRODUCTS=sigo,noexiste`), foco visible con Tab en menú y botones.
- [ ] **Step 4: Escritorio**: `npm run build`; con la app instalada cerrada, `npx electron .` → ventana de 900 px mínimo en modo iconos, datos cargados, sin pedir token.
- [ ] **Step 5: Commit** — `feat: acceso y DESIGN.md con la paleta nueva`
