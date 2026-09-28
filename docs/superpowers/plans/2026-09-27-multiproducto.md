# Panel multiproducto — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el panel muestre pipelines, bugs, milestones y horas de los productos de `comsatel/development/products` en los que cada dev trabaja, detectados por su actividad, con la marca "Panel de desarrollo Comsatel".

**Architecture:** Un módulo nuevo `src/dashboard/productos.ts` descubre el catálogo (subgrupos + proyectos) y detecta los productos de cada usuario con una función pura de umbral más señales de GitLab, cacheado por usuario. Pipelines, bugs, milestones y horas reciben esa lista en vez de rutas de SIGO fijas. El front agrupa por producto.

**Tech Stack:** TypeScript (ESM, NodeNext), Node 24 `node:test`, API REST v4 y GraphQL de GitLab 14.2.1, Electron 41, electron-builder.

**Spec:** `docs/superpowers/specs/2026-09-27-multiproducto-design.md`

## Global Constraints

- Raíz: `PRODUCTS_GROUP`, por defecto `comsatel/development/products`.
- Producto = subgrupo de **primer nivel** bajo la raíz. Un repo directamente en la raíz (`collaboration`, `seguridad-web`) no pertenece a ningún producto.
- Umbral: un producto cuenta si `abiertos >= 1 || eventos >= 5`; eventos de los últimos **30 días**.
- Cachés: catálogo **30 min** (global); detección **1 h por usuario** (nunca compartida entre usuarios: la web es multiusuario).
- `DASHBOARD_PRODUCTS` (slugs separados por coma) anula la detección; `DASHBOARD_PROJECTS` sigue mandando en pipelines; `TIMELOG_GROUP` sigue mandando en horas.
- Tope de proyectos del catálogo: **1000**.
- Horas: presupuesto total de **20 000 ms**; si se agota, `parcial: true`.
- Nombre visible: **Panel de desarrollo Comsatel**. Token sugerido: **Panel Comsatel**.
- Claves de `localStorage` `panel-sigo:*`: **no se renombran**.
- `userData` de Electron fijo en `<appData>/Panel GitLab SIGO`; `appId` `com.comsatel.panel-gitlab` sin cambios.
- Manifiesto por defecto: proyecto `comsatel/development/products/collaboration`.
- Solo lectura sobre GitLab; interfaz en español; una sección que falla no tumba las demás.
- Tras cada tarea: `npx tsc --noEmit && npx tsc -p tsconfig.api.json` sin errores y `npm test` en verde.

## Review Focus

1. **Usuario sin actividad** → lista vacía, pipelines no hace ninguna petición y la UI dice "No detectamos productos con tu actividad reciente" (tests en Task 1 y Task 2).
2. **Actividad en proyectos fuera de la raíz o en la raíz misma** (otros grupos de GitLab, `products/collaboration`) → se ignora, no crea un "producto" (tests en Task 1).
3. **`/events` falla o tarda** (403, 500, red) → la detección sigue con issues/MRs abiertos (test en Task 1).
4. **Dos usuarios en la misma instancia web** → cada uno ve sus productos; la caché no se cruza (test en Task 1).
5. **Horas que no caben en el presupuesto** → `parcial: true` y aviso visible, nunca una cifra baja sin avisar (test en Task 4, UI en Task 5).

---

### Task 1: Infra de tests y detección de productos

**Files:**
- Create: `src/dashboard/productos.ts`
- Create: `src/dashboard/productos.test.ts`
- Modify: `package.json` (script `test`)

**Interfaces:**
- Produces:
  - `raizProductos(): string`
  - `interface Producto { slug: string; nombre: string }`
  - `interface ProyectoCatalogo { id: number; path: string; producto: string | null; jobsEnabled: boolean }`
  - `productoDe(path: string, raiz?: string): string | null` — primer segmento tras la raíz, `null` si el repo está en la raíz o fuera de ella.
  - `catalogo(client: GitLabClient): Promise<{ productos: Producto[]; proyectos: ProyectoCatalogo[] }>` — subgrupos (`/groups/<raiz>/subgroups`, `nombre` = `name` de GitLab) y proyectos (`/groups/<raiz>/projects`, `include_subgroups: true`, tope 1000, sin `simple` porque hace falta `jobs_enabled`). Caché 30 min.
  - `contarActividad(proyectoAProducto: Map<number, string | null>, abiertos: number[], eventos: number[]): Record<string, { abiertos: number; eventos: number }>` — pura; ids desconocidos o con producto `null` se ignoran.
  - `elegirProductos(conteos: Record<string, { abiertos: number; eventos: number }>): string[]` — pura; aplica el umbral, ordena por `abiertos + eventos` descendente y desempata por slug.
  - `detectarProductos(client: GitLabClient, username: string): Promise<Producto[]>` — `DASHBOARD_PRODUCTS` si existe (slug sin nombre conocido → `nombre = slug`); si no, issues `scope=assigned_to_me` + MRs `scope=created_by_me` + MRs `reviewer_username` (abiertos) y `/events?after=<hoy-30>` (tope 300), cada fuente con su propio `catch` → `[]`. Caché 1 h con clave `username`.
  - `invalidarCaches(): void` — para tests.

- [ ] **Step 1: Añadir el script** `"test": "npm run build && node --test \"dist/**/*.test.js\""` a `package.json`.

- [ ] **Step 2: Escribir los tests que fallan** en `src/dashboard/productos.test.ts` (`node:test` + `node:assert/strict`):
  - `productoDe`: `"comsatel/development/products/sigo/microservices/bff"` → `"sigo"`; `".../products/collaboration"` → `null`; `"otro/grupo/repo"` → `null`.
  - `contarActividad`: con `Map([[1,"sigo"],[2,null]])`, `abiertos=[1]`, `eventos=[1,1,2,99]` → `{ sigo: { abiertos: 1, eventos: 2 } }`.
  - `elegirProductos`: `{ sigo:{abiertos:0,eventos:152}, comunes:{abiertos:1,eventos:0}, "smart-suite":{abiertos:0,eventos:6}, clocator2:{abiertos:0,eventos:2} }` → `["sigo","smart-suite","comunes"]`; `{}` → `[]`; `{x:{abiertos:0,eventos:4}}` → `[]`; `{x:{abiertos:0,eventos:5}}` → `["x"]`.
  - `detectarProductos` con cliente falso (objeto con `get`/`getAll` que responde según la ruta, `as unknown as GitLabClient`):
    - `/events` lanza error y hay un issue abierto en un proyecto de `sigo` → `[{ slug: "sigo", nombre: "SIGO" }]`.
    - Usuario `ana` con eventos en `sigo` y usuario `luis` con eventos en `clocator2` (el falso decide por el `reviewer_username` o por una variable que cambia entre llamadas) → resultados distintos; llamar de nuevo con `ana` no vuelve a pedir `/events`.
    - `DASHBOARD_PRODUCTS=" sigo , nuevo "` → `[{slug:"sigo",nombre:"SIGO"},{slug:"nuevo",nombre:"nuevo"}]`, sin pedir `/events`.
  - Cada test llama a `invalidarCaches()` antes y limpia `process.env.DASHBOARD_PRODUCTS` después.

- [ ] **Step 3: Verificar que fallan.** Run: `npm test` → Expected: FAIL, no existe `dist/dashboard/productos.js`.

- [ ] **Step 4: Implementar `src/dashboard/productos.ts`** según las interfaces de arriba, reutilizando `encodeProject` y `mapLimit` (de `proyectos.ts`) donde haga falta. `hoy-30` con `sumarDias(enZona().fecha, -30)` de `zona.ts`.

- [ ] **Step 5: Verificar.** Run: `npm test` → Expected: PASS todos.

- [ ] **Step 6: Commit** — `git add package.json src/dashboard/productos.ts src/dashboard/productos.test.ts` · `git commit -m "feat: detectar productos por actividad del usuario"`

---

### Task 2: Pipelines de los productos detectados

**Files:**
- Modify: `src/dashboard/proyectos.ts` (quitar su caché y el `GRUPO_POR_DEFECTO` SIGO; `proyectosVigilados` y `separarRuta` nuevas)
- Modify: `src/dashboard/snapshot.ts` (`pipelinesVigilados`, tipo `Snapshot["pipelines"]`)
- Modify: `src/dashboard/api.ts` (`pipelines`), `src/dashboard/server.ts`, `src/web/server.ts`, `api/pipelines.ts`
- Create: `src/dashboard/proyectos.test.ts`

**Interfaces:**
- Consumes: `catalogo`, `detectarProductos`, `raizProductos`, `Producto` (Task 1).
- Produces:
  - `separarRuta(path: string): { producto: string; grupo: string; nombre: string }` — relativa a `raizProductos()`; `grupo` es la carpeta dentro del producto o `"(sin carpeta)"`.
  - `proyectosVigilados(client: GitLabClient, productos: string[]): Promise<ProyectoVigilado[]>` — `DASHBOARD_PROJECTS` primero; si `productos` está vacío devuelve `[]` sin pedir nada; si no, filtra el catálogo por `producto ∈ productos` y `jobsEnabled`.
  - `pipelinesVigilados(client: GitLabClient, username: string)` — detecta productos y consulta; devuelve las mismas filas que hoy más `producto: string` (slug) y `productoNombre: string`, y `Snapshot["pipelines"]` gana esos dos campos.
  - `DashboardApi.pipelines(username: string)`.

- [ ] **Step 1: Tests que fallan** en `src/dashboard/proyectos.test.ts`:
  - `separarRuta(".../products/sigo/servicios-soa/tareas/api")` → `{ producto:"sigo", grupo:"servicios-soa/tareas", nombre:"api" }`; `".../products/comunes/libs"` → `{ producto:"comunes", grupo:"(sin carpeta)", nombre:"libs" }`.
  - `proyectosVigilados(falso, [])` → `[]` y el cliente falso registra **0** llamadas.

- [ ] **Step 2: Verificar que fallan.** Run: `npm test` → Expected: FAIL en `proyectos.test`.

- [ ] **Step 3: Implementar** los cambios de `proyectos.ts` y `snapshot.ts`; `construirSnapshot` pasa `username` a `pipelinesVigilados`. Actualizar las tres rutas `/api/pipelines` para pasar el username de la sesión (`me.username`, `sesion.usuario.username`, `ctx.sesion.usuario.username`).

- [ ] **Step 4: Verificar.** Run: `npx tsc --noEmit && npx tsc -p tsconfig.api.json && npm test` → Expected: sin errores, PASS.

- [ ] **Step 5: Commit** — `git commit -m "feat: vigilar pipelines de los productos detectados"` (archivos de la tarea).

---

### Task 3: Resumen con productos, bugs y milestones por producto

**Files:**
- Modify: `src/dashboard/api.ts` (`summary`, constante `COLLAB` y su export)

**Interfaces:**
- Consumes: `detectarProductos`, `raizProductos` (Task 1); `mapLimit`.
- Produces — nuevo shape de `summary(username)`:
  - `productos: Producto[]`
  - `bugs: Array<{ producto: string; productoNombre: string; estado: string; total: number; url: string }>` — un elemento por producto × estado de `BUG_STATES`; `total` desde `x-total` de `/groups/<raiz>/<slug>/issues?labels=<estado>&state=opened&per_page=1`; `url` = `<gitlabUrl>/groups/<raiz>/<slug>/-/issues?label_name[]=<estado>&state=opened`. Peticiones con `mapLimit(…, 6, …)`.
  - `milestones: Array<{ id: number; titulo: string; vence: string | null; producto: string }>` — de `<raiz>/<slug>/collaboration`; un 404 de ese proyecto se omite en silencio (no va a `errors`).
  - Se elimina `collaboration` del resultado (el front no lo usa; verificar con `grep -n collaboration public/index.html`).

- [ ] **Step 1: Implementar** el nuevo `summary`. Cada bloque sigue envuelto en `settle` para que un fallo no tumbe el resto.

- [ ] **Step 2: Verificar contra GitLab real** (solo lectura) con un script en el scratchpad que llame a `new DashboardApi(client, config).summary(<username>)` usando el `.env`: Expected: `productos` = sigo, smart-suite, comunes (en ese orden aproximado); `bugs.length === 3 * 6`; `errors` vacío.

- [ ] **Step 3: Verificar tipos.** Run: `npx tsc --noEmit && npx tsc -p tsconfig.api.json` → sin errores.

- [ ] **Step 4: Commit** — `git commit -m "feat: bugs y milestones por producto en el resumen"`

---

### Task 4: Horas de varios grupos con presupuesto de tiempo

**Files:**
- Modify: `src/dashboard/timelogs.ts` (`fetchAll`, `buildTimelogReport`, `TimelogReport`, quitar `DEFAULT_GROUP`)
- Modify: `src/dashboard/snapshot.ts` (URL del aviso de horas)
- Create: `src/dashboard/timelogs.test.ts`

**Interfaces:**
- Consumes: `detectarProductos`, `raizProductos` (Task 1).
- Produces:
  - `buildTimelogReport(client, username, opciones: { dias?: number; grupos?: string[]; presupuestoMs?: number })` — grupos: `opciones.grupos` ?? `[TIMELOG_GROUP]` si existe ?? `detectarProductos(...)` → `<raiz>/<slug>`. Consulta los grupos en secuencia compartiendo un plazo `Date.now() + (presupuestoMs ?? 20000)`; al vencer deja de paginar.
  - `TimelogReport` añade `grupos: string[]` (sustituye a `grupo`) y `parcial: boolean`.
  - URL del aviso de horas: `<gitlabUrl>/dashboard/issues?assignee_username=<username>&state=opened`.

- [ ] **Step 1: Tests que fallan** en `src/dashboard/timelogs.test.ts`, con cliente falso cuyo `graphql` espera 30 ms y devuelve 1 registro del usuario con `hasNextPage: true` siempre:
  - `buildTimelogReport(falso, "yo", { dias: 3, grupos: ["g1"], presupuestoMs: 100 })` → `parcial === true` y termina en menos de 1 s.
  - Falso con `hasNextPage: false` en dos grupos `["g1","g2"]` → `parcial === false`, `grupos` igual a la entrada y las horas de ambos sumadas.
  - `grupos: []` → informe con horas en cero, `parcial === false` y 0 llamadas.

- [ ] **Step 2: Verificar que fallan.** Run: `npm test` → Expected: FAIL.

- [ ] **Step 3: Implementar.** Quitar el tope de 15 páginas; el plazo es el único límite.

- [ ] **Step 4: Verificar.** Run: `npm test` → PASS. Corregir cualquier uso de `reporte.grupo` que señale `tsc`.

- [ ] **Step 5: Commit** — `git commit -m "feat: horas de los productos detectados con presupuesto de tiempo"`

---

### Task 5: Interfaz multiproducto

**Files:**
- Modify: `public/index.html`

**Interfaces:**
- Consumes: `summary.productos`, `summary.bugs[].producto/productoNombre` (Task 3); filas de `/api/pipelines` con `productoNombre` (Task 2); `timelogs.parcial` (Task 4).

- [ ] **Step 1: Cabecera.** Añadir `<span class="quien" id="productos"></span>` junto a `#who`; tras `/api/summary` pintar `Productos: ${nombres.join(" · ")}` o `Sin productos detectados`. Guardar `s.productos` en una variable global para el paso 2.

- [ ] **Step 2: Pipelines.** En `pintarPipelines`, la clave de carpeta pasa a ser `` `${p.productoNombre} › ${p.grupo}` `` (visible y en `data-carpeta`), y la búsqueda incluye `p.productoNombre`. Vacío: si no hay productos detectados → `vacio("No detectamos productos con tu actividad reciente", "Aparecerán cuando tengas issues, merge requests o actividad en algún producto.")`; si hay productos pero no filas → `vacio("Sin repositorios con pipelines", "Se vigilan los repositorios con CI activo de tus productos.")`.

- [ ] **Step 3: Bugs.** `pintarBugs` agrupa por `productoNombre`: un subtítulo por producto y sus barras debajo; la escala `max` es común a todos. Vacío: `"No se encontraron bugs abiertos en tus productos."`.

- [ ] **Step 4: Horas parciales.** Si `r.parcial`, añadir a `#horas-aviso` `"Total parcial: hay más registros de los que se pudieron leer."`.

- [ ] **Step 5: Copy.** Sustituir los textos con "SIGO" listados en el spec (título, `h1` → `Panel de desarrollo </span>…Comsatel`, textos vacíos, comentarios de `repo()` y de columnas de entornos). No tocar `CLAVE_PLEGADAS`, `CLAVE_AVISOS`, `CLAVE_ESTADO`.

- [ ] **Step 6: Verificar visualmente** con `npm run dashboard` (servidor local, token del `.env`) en el navegador: la cabecera lista los productos, las carpetas se leen "SIGO › microservices" y los bugs salen en bloques por producto. Revisar también a 375 px de ancho: sin scroll horizontal.

- [ ] **Step 7: Commit** — `git commit -m "feat: interfaz agrupada por producto"`

---

### Task 6: Marca, escritorio y manifiesto

**Files:**
- Modify: `public/login.html`, `public/token.html`, `src/desktop/main.ts`, `src/desktop/actualizaciones.ts`, `package.json` (`build.productName`, `build.dmg.title`, `build.win.artifactName`, `build.mac.artifactName`), `.env.example`, `publicacion/README.md`, `PRODUCT.md`

- [ ] **Step 1: Textos.** `login.html`: título y `h1` "Panel de desarrollo Comsatel". `token.html`: "Nombre: **Panel Comsatel**". `main.ts`: `title: "Panel de desarrollo Comsatel"`, tooltip y etiquetas de la bandeja con "Panel Comsatel" en lugar de "Panel GitLab". `productName` y `dmg.title` = "Panel de desarrollo Comsatel"; `artifactName` con prefijo `PanelDesarrolloComsatel-`.

- [ ] **Step 2: `userData` estable.** En `main.ts`, antes de `app.requestSingleInstanceLock()`: `app.setPath("userData", resolve(app.getPath("appData"), "Panel GitLab SIGO"))`, con un comentario que diga por qué (credencial y `estado.json` de las instalaciones existentes).

- [ ] **Step 3: Manifiesto.** Por defecto `comsatel/development/products/collaboration` en `actualizaciones.ts`, `.env.example` y `publicacion/README.md`. Añadir `PRODUCTS_GROUP` y `DASHBOARD_PRODUCTS` comentados a `.env.example`; cambiar la ayuda de `TIMELOG_GROUP` (ya no es obligatorio: por defecto los productos detectados).

- [ ] **Step 4: `PRODUCT.md`.** Actualizar Users, Positioning y Brand Commitments ("Panel de desarrollo Comsatel", productos detectados por actividad).

- [ ] **Step 5: Verificar.** Run: `npm run build && npx electron .` → la ventana se titula "Panel de desarrollo Comsatel" y **no pide el token** (lo lee de la carpeta antigua). `grep -rn "SIGO" public src api` → solo quedan comentarios históricos o nombres de repos.

- [ ] **Step 6: Commit** — `git commit -m "feat: marca Panel de desarrollo Comsatel y manifiesto en products"`

---

### Task 7: Verificación de punta a punta

- [ ] **Step 1:** `npx tsc --noEmit && npx tsc -p tsconfig.api.json && npm test` → todo en verde.
- [ ] **Step 2:** Con la cuenta real, `npm run dashboard`: medir el tiempo de `/api/summary`, `/api/pipelines` y `/api/timelogs?dias=14` (esperado: cada uno bajo 20 s; anotar los valores reales).
- [ ] **Step 3:** Con `DASHBOARD_PRODUCTS=clocator2` comprobar que se ve solo clocator2 (simula a un dev de otro producto).
- [ ] **Step 4:** Revisar `DESPLIEGUE-VERCEL.md` por menciones a SIGO que ya no sean ciertas y corregirlas.
