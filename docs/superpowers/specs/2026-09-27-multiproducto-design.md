# Panel multiproducto — diseño

Fecha: 2026-09-27 · Estado: aprobado en conversación, pendiente de revisión escrita

## Objetivo

El panel deja de ser exclusivo de SIGO. Cualquier desarrollador de
`comsatel/development/products` lo usa para su trabajo diario y el panel
**deduce solo** en qué productos trabaja. Éxito: un dev de clocator2 abre el
panel y ve sus pipelines, bugs, milestones y horas de clocator2 sin configurar
nada y sin que el panel se vuelva lento.

Se conservan: los tres modos (escritorio, web local, Vercel), solo lectura,
"nunca bloquear" (una sección que falla no tumba las demás) y la interfaz en
español.

## Datos medidos (GitLab 14.2.1, cuenta de nrolando, 2026-09-27)

| Hecho | Consecuencia |
|---|---|
| `products` tiene 6 subgrupos (analitica-datos, clocator, clocator2, comunes, sigo, smart-suite), un `collaboration` raíz y el repo suelto `seguridad-web`; 226 repos, 222 con CI | Productos = subgrupos de primer nivel, descubiertos |
| `proyectosVigilados` corta en 200 | Hay que subir el tope |
| `/events` de 30 días: 217 eventos en ~3 s | Señal útil pero cara: se cachea |
| Labels `Bug :: …` definidas a nivel `products` | Se pueden contar bugs por grupo de producto |
| Milestones: 0 a nivel grupo; 7–11 en cada `collaboration` | Se leen del `collaboration` de cada producto |
| Timelogs de todo `products`: 14 d = 9 s, 90 d > 36 s | Inviable leer todo; se leen solo los productos detectados |
| Timelogs con filtro `username`: error 500 | No hay filtro por usuario en 14.2 |
| Horas vía issues asignados: 47 de ≥123 registros | Descartado |
| SIGO 90 d = 17 páginas y el código corta en 15 | Bug actual: la vista de 90 días ya pierde registros |

## 1. Detección de productos

Módulo nuevo `src/dashboard/productos.ts`:

- `raizProductos()`: `PRODUCTS_GROUP`, por defecto `comsatel/development/products`.
- `catalogo(client)`: subgrupos de primer nivel (slug + nombre real de GitLab) y
  todos los proyectos bajo la raíz (`include_subgroups`, tope 1000), cada uno
  con `id`, `path`, `producto` (primer segmento tras la raíz) y `jobs_enabled`.
  Caché en memoria de 30 min (sustituye la caché actual de `proyectos.ts`).
- `elegirProductos(conteos)`: **función pura**. Entra
  `{ producto: { abiertos: number; eventos: number } }`, sale la lista de
  productos con `abiertos >= 1 || eventos >= 5`, ordenada por actividad.
- `detectarProductos(client, username)`: si existe `DASHBOARD_PRODUCTS`
  (slugs separados por coma) se usa tal cual. Si no, consulta issues asignados
  abiertos, MRs propios y por revisar abiertos, y `/events?after=hoy-30`; mapea
  cada `project_id` a su producto con el catálogo y llama a `elegirProductos`.
  Caché por usuario de 1 h. Los proyectos fuera de la raíz se ignoran.
- Sin productos detectados: lista vacía. El panel muestra "No detectamos
  productos con tu actividad reciente" y no consulta pipelines.

En Vercel la caché en memoria es de mejor esfuerzo (sobrevive en instancias
calientes); una instancia fría paga ~3 s más.

`DASHBOARD_PROJECTS` sigue teniendo prioridad sobre todo lo anterior para
pipelines.

## 2. Qué muestra cada panel

- **Productos detectados**: `summary` devuelve `productos: [{ slug, nombre }]`;
  la cabecera muestra "Productos: SIGO · Comunes · Smart Suite".
- **Pipelines**: `pipelinesVigilados(client, productos)` solo recorre repos de
  esos productos. `separarRuta` pasa a ser relativo a la raíz y devuelve
  `{ producto, grupo, nombre }`. El front agrupa por producto y luego por
  carpeta ("SIGO › microservices"); se conservan filtros, plegado y columnas de
  entornos. Concurrencia 6, sin cambios.
- **Bugs por estado**: por cada producto detectado, `x-total` de
  `/groups/<producto>/issues?labels=<estado>&state=opened` para cada estado de
  `BUG_STATES`. Peticiones en paralelo con `mapLimit` (hoy son secuenciales).
  Un bloque por producto. Cambio de criterio consciente: cuenta bugs de
  cualquier repo del producto, no solo de su `collaboration`.
- **Milestones**: activos del `<producto>/collaboration` de cada producto
  detectado; si no existe (clocator, comunes) se omite sin error. Cada
  milestone lleva su producto.
- **Issues, MRs, To-Do**: sin cambios (ya son globales).
- **Enlace del aviso de horas**: `…/dashboard/issues?assignee_username=<u>`
  (global), en vez de la lista de `sigo/collaboration`.

## 3. Horas

- `buildTimelogReport` recibe los grupos a consultar: los productos detectados
  (`TIMELOG_GROUP`, si está definido, sigue mandando). Consulta cada grupo y
  une los registros; los grupos son disjuntos, no hay duplicados.
- El tope de 15 páginas se sustituye por un **presupuesto de tiempo** total
  de 20 s (por debajo de los 30 s de Vercel). Si se agota, el informe marca
  `parcial: true` y el front muestra "Total parcial: hay más registros de los
  que se pudieron leer".
- `totalEquipoHoras` pasa a ser la suma de los grupos consultados.
- Limitación aceptada: no cuentan las horas registradas en un producto sin
  actividad detectada.

## 4. Marca y actualizaciones

- Nombre: **Panel de desarrollo Comsatel** en `index.html`, `login.html`,
  título de la ventana, `productName` del instalador y textos que citan SIGO.
  El token sugerido pasa a llamarse "Panel Comsatel".
- Las claves de `localStorage` (`panel-sigo:*`) **no** se renombran: se
  perdería el historial de avisos de quien ya lo usa.
- `userData` de Electron depende de `productName`: al renombrar, la app
  buscaría la credencial y `estado.json` en otra carpeta y pediría el token de
  nuevo. Se fija `app.setPath("userData", <appData>/Panel GitLab SIGO)` antes de
  `whenReady` para conservarlos. `appId` no cambia, así el instalador nuevo
  actualiza al anterior.
- Manifiesto de versiones: por defecto en
  `comsatel/development/products/collaboration` (el raíz), para que devs sin
  acceso a SIGO también reciban avisos. `UPDATE_PROJECT` sigue mandando.
- `PRODUCT.md`: se actualizan nombre, usuarios y posicionamiento.

## Manejo de errores

- Falla la detección (eventos caídos): se usan solo issues y MRs abiertos; si
  también fallan, se devuelve la última detección cacheada o lista vacía.
- Falla un producto en bugs o milestones: ese bloque muestra su error, el resto
  sigue (patrón `settle` existente).
- Catálogo inaccesible: pipelines muestra su error; issues/MRs siguen.

## Pruebas

No hay infraestructura de tests. Se añade `node --test` sobre `dist/` con un
script `npm test`, para las funciones puras:

- `elegirProductos`: umbral de eventos, issue abierto basta, orden, vacío.
- `separarRuta`: producto, carpeta anidada, repo en la raíz del producto,
  repo fuera de la raíz.
- Presupuesto de horas: con un cliente falso lento, `parcial` se marca.

Verificación manual: panel local con la cuenta real (deben salir sigo, comunes
y smart-suite), revisión visual de la agrupación por producto y `tsc` de
`src` y `api`.

## Fuera de alcance

Selector manual de productos en la UI, vista global de toda la organización,
cambios en el servidor MCP.
