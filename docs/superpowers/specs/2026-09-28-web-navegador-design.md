# Web en Vercel con consultas desde el navegador — diseño

Fecha: 2026-09-28 · Estado: aprobado en conversación, pendiente de revisión escrita

## Problema

La red de Comsatel bloquea GitLab desde fuera: vista desde Vercel,
`project.comsatel.com.pe` responde `503` con "La página no se encuentra
disponible para acceso desde la red externa". Las funciones de Vercel no pueden
consultarlo. Todos los usuarios de la web estarán en la **VPN**, y GitLab
permite CORS con `PRIVATE-TOKEN` (`Access-Control-Allow-Origin: *`, expone
`X-Total` y `X-Next-Page`, verificado el 2026-09-28 para `/api/v4` y
`/api/graphql`). Por tanto, quien debe llamar a GitLab es el navegador.

## Objetivo

En Vercel, el panel funciona para cualquier persona conectada a la VPN, que
entra con su propio token de acceso personal (scope `read_api`), con la misma
interfaz y los mismos datos que el escritorio. Éxito: abrir
`https://dev-gitlab-mcp.vercel.app` con VPN, pegar el token y ver productos,
pipelines, bugs y horas; sin VPN, un mensaje claro.

No cambian: la app de escritorio y el servidor web local (`npm run web`).

## 1. Arquitectura

```
Navegador (VPN) ──► GitLab de Comsatel
     ▲
Vercel: solo archivos estáticos (public/)
```

- Vercel deja de ejecutar funciones: se retira `api/` y su configuración en
  `vercel.json`. Sirve `public/` tal cual.
- Nuevo punto de entrada `src/web/navegador.ts`, empaquetado con **esbuild**
  (devDependency nueva) en `public/panel.js`. Expone en `window.PanelNavegador`
  las mismas operaciones que hoy sirven las rutas: `me()`, `summary()`,
  `pipelines()`, `timelogs(dias)`, `notificaciones(estadoPrevio)` →
  `{ avisos, estado }`, con los mismos formatos de respuesta.
- Reutiliza sin copiar: `GitLabClient` (modo `pat`), `DashboardApi`,
  `pipelinesVigilados`, `buildTimelogReport`, `construirSnapshot`, `comparar`,
  `productos.ts`, `zona.ts`. En el navegador no hay `process.env`: el paquete
  define `process.env` como objeto vacío salvo `GITLAB_URL`, que se fija al
  compilar (por defecto `https://project.comsatel.com.pe`); todo lo demás usa
  sus valores por defecto. Las cachés (catálogo, detección) viven en la pestaña.
- Vercel compila el paquete: `buildCommand` = `npm run build:web`
  (esbuild), `installCommand` = `npm install --ignore-scripts`.

## 2. Modo de la página

- `index.html` y `login.html` averiguan el modo con `GET /api/me`:
  - responde 200 o 401 → **servidor** (escritorio o `npm run web`): todo como hoy;
  - 404 (hosting estático) → **navegador**: se carga `/panel.js` y `pedir(ruta)`
    se resuelve con `window.PanelNavegador` en vez de `fetch`.
- `modoSesion` en navegador es `"web"`, así que avisos en `localStorage` y
  cierre de sesión siguen el camino web existente.
- Los servidores de escritorio y local no necesitan servir `panel.js` (solo se
  pide en modo navegador).

## 3. Login y token

- `login.html` en modo navegador valida el token con `GET {GITLAB_URL}/api/v4/user`
  directamente desde el navegador, reutilizando `validarToken` (empaquetado).
- Guarda el token en **`sessionStorage`** (`panel-comsatel:token`): se borra al
  cerrar la pestaña. Nunca en `localStorage`, cookies ni URL.
- Sin VPN, la petición falla por red: mensaje "No se alcanza GitLab. ¿Estás
  conectado a la VPN?".
- `index.html` en modo navegador sin token → redirige a `/login`. Un 401 de
  GitLab durante el uso borra el token y redirige a `/login`.
- Cerrar sesión: borra el token de `sessionStorage` y el historial de avisos
  (`panel-sigo:avisos`, `panel-sigo:estado`) y va a `/login`. No revoca el token.

## 4. Protección del token

Cabeceras en `vercel.json` para todas las rutas:

- `Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline'; connect-src 'self' https://project.comsatel.com.pe;
  img-src 'self' data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`.
  Aunque se inyectara código, el navegador no deja enviar el token a otro host
  (ni por `fetch` ni por imágenes).
- Se mantienen `X-Content-Type-Options`, `X-Frame-Options` y `Referrer-Policy`
  (`no-referrer` para no filtrar la URL).
- Todo texto de GitLab sigue pasando por `esc()`/`textContent`.

## Manejo de errores

- Una sección que falla sigue sin tumbar las demás (`summary.errors`).
- Fallo de red a mitad de uso: el aviso actual de "sin conexión" pasa a decir
  "No se alcanza GitLab. ¿Estás conectado a la VPN?" en modo navegador.

## Pruebas

- `npm test` sigue verde (40).
- Nueva prueba: el paquete `public/panel.js` se genera y no contiene
  `require("node:` ni imports de `node:` (romperían en el navegador).
- Navegador (servidor estático local sirviendo `public/` con el paquete):
  modo navegador detectado; login con token falso → mensaje de token inválido;
  GitLab inalcanzable simulado → mensaje de VPN; la CSP de `vercel.json`
  aplicada en producción (cabecera presente).
- Producción: la página carga, `panel.js` responde, `/api/me` da 404, la
  cabecera CSP está. El login con un token real lo prueba el usuario con VPN.

## Fuera de alcance

Recordar el token entre sesiones, cambios en escritorio o `npm run web`, mover
el JS inline de `index.html` a archivos (permitiría una CSP sin `'unsafe-inline'`).
