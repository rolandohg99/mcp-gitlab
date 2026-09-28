# Web en Vercel desde el navegador — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que en Vercel el navegador de cada usuario (con VPN) consulte GitLab directamente con su token personal, con la misma interfaz y datos que el escritorio.

**Architecture:** Un punto de entrada `src/web/navegador.ts` reutiliza la lógica existente (`DashboardApi`, `pipelinesVigilados`, `buildTimelogReport`, `construirSnapshot`, `comparar`, `validarToken`) y se empaqueta con esbuild en `public/panel.js`. `index.html` y `login.html` detectan el modo con `GET /api/me`: 404 → modo navegador. Vercel pasa a servir solo estáticos, con CSP.

**Tech Stack:** TypeScript, esbuild (devDependency nueva), `node:test`, Vercel estático.

**Spec:** `docs/superpowers/specs/2026-09-28-web-navegador-design.md`

## Global Constraints

- El token solo en `sessionStorage`, clave `panel-comsatel:token`. Nunca en `localStorage`, cookie, URL ni registros.
- GitLab por defecto `https://project.comsatel.com.pe`, fijado al compilar el paquete (`GITLAB_URL` del entorno de build si existe).
- Modo navegador **solo** si `GET /api/me` responde 404. 200/401 → modo servidor sin cambios; error de red → comportamiento actual de "servidor caído".
- Mensaje sin red en modo navegador: `No se alcanza GitLab. ¿Estás conectado a la VPN?`
- CSP exacta: `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://project.comsatel.com.pe; img-src 'self' data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`. `Referrer-Policy: no-referrer`.
- Escritorio y `npm run web` sin cambios de comportamiento.
- Tras cada tarea: `npm test` en verde.

## Review Focus

1. **Sin VPN** en el login y a mitad de uso → mensaje de VPN, sin bucles de redirección ni pantalla rota (Task 1 tests + Task 2 navegador).
2. **Token que caduca durante el uso** (401 de GitLab) → se borra y se vuelve a `/login` una sola vez (Task 1 tests).
3. **`sessionStorage` bloqueado** (lanza al escribir) → el login muestra "Tu navegador no permite guardar la sesión en esta pestaña", no queda en bucle (Task 1 tests + Task 2).
4. **Escritorio con el servidor caído** → sigue mostrando "servidor caído"; no cae por error en modo navegador (Task 2).
5. **El paquete no arrastra Node** (`node:crypto`, `node:fs`…) → fallaría al cargar en el navegador (Task 1 test).

---

### Task 1: Paquete del navegador

**Files:**
- Create: `src/web/navegador.ts`, `src/web/navegador.test.ts`, `scripts/build-web.mjs`, `scripts/panel.test.mjs`
- Modify: `package.json` (devDependency `esbuild`, scripts `build:web` y `test`), `.gitignore` (`public/panel.js`)

**Interfaces:**
- Produces:
  - `interface Almacen { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }`
  - `class ErrorPanel extends Error { tipo: "sesion" | "red" | "almacen" }`
  - `crearPanel(deps: { almacen: Almacen; crear: (token: string) => GitLabClient; gitlabUrl: string })` → objeto con:
    - `iniciarSesion(token: string): Promise<ResultadoToken>` — `validarToken`; si ok guarda el token recortado; si `setItem` lanza → `{ ok: false, error: "Tu navegador no permite guardar la sesión en esta pestaña." }`; si GitLab es inalcanzable el error es el mensaje de VPN.
    - `cerrarSesion(): void` — borra el token y `panel-sigo:avisos`, `panel-sigo:estado`.
    - `tieneToken(): boolean`
    - `me()`, `summary()`, `pipelines()`, `timelogs(dias: number)`, `notificaciones(estadoPrevio: Estado | null): Promise<{ avisos; estado }>` — mismos formatos que las rutas `/api/*` de Vercel (`me` devuelve `{ ...usuario, modo: "web", puedeCerrarSesion: true }`).
    - Sin token → lanzan `ErrorPanel("sesion")`. `GitLabError` 401 → borran el token y lanzan `ErrorPanel("sesion")`. `GitLabError` status 0 → `ErrorPanel("red")` con el mensaje de VPN.
  - Al final del módulo: si existe `globalThis.window`, `window.PanelNavegador = crearPanel({ almacen: sessionStorage, crear: (t) => new GitLabClient(URL, t, "pat"), gitlabUrl: URL })` donde `URL = process.env.GITLAB_URL || "https://project.comsatel.com.pe"`.
  - `scripts/build-web.mjs`: esbuild `bundle`, `format: "iife"`, `platform: "browser"`, `target: "es2022"`, `outfile: "public/panel.js"`, `define: { "process.env": JSON.stringify({ GITLAB_URL: process.env.GITLAB_URL || "https://project.comsatel.com.pe" }) }`, `minify: true`.
  - Script `build:web` = `node scripts/build-web.mjs`; `test` = `npm run build && npm run build:web && node --test "dist/**/*.test.js" "scripts/*.test.mjs"`.

- [ ] **Step 1: Tests que fallan** en `src/web/navegador.test.ts` con almacén en memoria y cliente falso:
  - `iniciarSesion("  glpat-x  ")` válido → `tieneToken()` true y el almacén guarda `"glpat-x"`; inválido (401) → no guarda.
  - `iniciarSesion` con `setItem` que lanza → `ok:false` y el mensaje de almacenamiento.
  - `iniciarSesion` con cliente que lanza `GitLabError(…, 0)` → `ok:false` con el mensaje de VPN.
  - `summary()` sin token → rechaza con `tipo === "sesion"`.
  - `me()` con token y cliente que lanza 401 → rechaza con `tipo === "sesion"` y `tieneToken()` false.
  - `cerrarSesion()` borra token, `panel-sigo:avisos` y `panel-sigo:estado`.
  - En `scripts/panel.test.mjs`: `public/panel.js` existe, no contiene `node:` ni `require(`, y contiene `PanelNavegador`.
- [ ] **Step 2: Verificar que fallan.** Run: `npm test` → Expected: FAIL (no existe `navegador.ts`).
- [ ] **Step 3: Implementar** `navegador.ts`, `build-web.mjs`, instalar `esbuild` (`npm i -D esbuild`), scripts y `.gitignore`. Acceder a `window`/`sessionStorage` vía `globalThis` (tsconfig sin DOM).
- [ ] **Step 4: Verificar.** Run: `npm test` → PASS. Run: `npx tsc -p tsconfig.api.json` → sin errores.
- [ ] **Step 5: Commit** — `feat: paquete del panel para el navegador`

---

### Task 2: Modo navegador en las páginas

**Files:** Modify: `public/index.html`, `public/login.html`

**Interfaces:**
- Consumes: `window.PanelNavegador` (Task 1).
- Produces:
  - `async function detectarModo(): Promise<"servidor" | "navegador">` en ambas páginas — `fetch("/api/me")`: 404 → carga `<script src="/panel.js">` (esperando `onload`) y devuelve `"navegador"`; cualquier otra respuesta → `"servidor"`; error de red → `"servidor"`.
  - `index.html`: `pedir(ruta)` en modo navegador resuelve `/api/me`, `/api/summary`, `/api/pipelines`, `/api/timelogs?dias=N` con `PanelNavegador`; `ErrorPanel("sesion")` → `location.href = "/login"`; `ErrorPanel("red")` → error con el mensaje de VPN. `avisosWeb()` usa `PanelNavegador.notificaciones(estadoPrevio)` en vez de `POST /api/notificaciones`. El botón de salir en modo navegador llama a `PanelNavegador.cerrarSesion()` y va a `/login`. Sin token al cargar → `/login`.
  - `login.html`: en modo navegador, si ya hay token → `/`; el envío llama a `PanelNavegador.iniciarSesion(token)` en vez de `POST /api/auth/token`.

- [ ] **Step 1: Implementar** ambos cambios; `cargar()` espera a `detectarModo()` antes de la primera petición.
- [ ] **Step 2: Verificar en el navegador** con el servidor estático (`public-estatico`, sirve `public/` con el paquete ya generado): `/api/me` → 404 → modo navegador; `/` sin token redirige a `/login`; login con `glpat-prueba-falsa` → "El token es inválido o venció…". Con el paquete generado con `GITLAB_URL=https://127.0.0.1:9` (inalcanzable) → mensaje de VPN; volver a generar con el valor por defecto después.
- [ ] **Step 3: Verificar modo servidor sin cambios**: config `dashboard` (escritorio) → la página carga datos como antes (subtítulo con productos) y `panel.js` no se pide (no aparece en `read_network_requests`). Con el servidor parado, recargar → mensaje de "servidor caído", no redirección al login del modo navegador.
- [ ] **Step 4: Commit** — `feat: páginas en modo navegador cuando no hay servidor`

---

### Task 3: Vercel estático con CSP

**Files:**
- Delete: `api/` (entero), `tsconfig.api.json`
- Modify: `vercel.json`, `.vercelignore` (quitar `scripts/`), `package.json` (quitar `check:api`, `vercel-build`; `check` = `tsc --noEmit`), `.gitlab-ci.yml` (quitar `npx tsc -p tsconfig.api.json`), `DESPLIEGUE-VERCEL.md`, `PRODUCT.md`

- [ ] **Step 1: `vercel.json`**: `framework: null`, `installCommand: "npm install --ignore-scripts"`, `buildCommand: "npm run build:web"`, `outputDirectory: "public"`, `rewrites: [{ "source": "/login", "destination": "/login.html" }]`, sin `functions`; cabeceras de Global Constraints para `/(.*)`.
- [ ] **Step 2: Borrar `api/`** y lo que lo referencia (`tsconfig.api.json`, scripts, CI). Run: `grep -rn "tsconfig.api\|api/_lib\|check:api" --include=*.json --include=*.yml --include=*.md .` → solo menciones históricas en `docs/`.
- [ ] **Step 3: Documentación**: DESPLIEGUE-VERCEL.md describe el modo navegador (VPN obligatoria, token en `sessionStorage`, CSP, ya no hay `SESSION_SECRET` ni funciones); PRODUCT.md, la web en Vercel consulta GitLab desde el navegador.
- [ ] **Step 4: Desplegar y verificar producción**: `npx vercel --prod --yes`; `curl -I https://dev-gitlab-mcp.vercel.app/` → cabecera `content-security-policy` exacta; `/panel.js` → 200; `/api/me` → 404; `/login` → 200. Quitar la variable `GITLAB_URL` de Vercel solo si el build no la necesita (el valor por defecto coincide): se deja.
- [ ] **Step 5: Commit** — `feat: Vercel estático; el navegador consulta GitLab por la VPN`
