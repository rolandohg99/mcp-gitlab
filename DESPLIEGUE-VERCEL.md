# Desplegar el panel en Vercel

La red de Comsatel bloquea GitLab desde fuera: vista desde Vercel,
`project.comsatel.com.pe` responde con una página del gateway (`503`, "La página
no se encuentra disponible para acceso desde la red externa"). Por eso **Vercel
no consulta GitLab**: solo sirve los archivos de `public/`, y es el navegador de
cada persona —conectado a la **VPN**— el que llama a GitLab.

```
Navegador (VPN) ──► GitLab de Comsatel
     ▲
Vercel: solo archivos estáticos (public/)
```

GitLab permite estas llamadas desde el navegador (CORS con `PRIVATE-TOKEN`,
`Access-Control-Allow-Origin: *`), verificado el 2026-09-28.

## 1. Cómo entra cada persona

Con **su propio token de acceso personal** (scope `read_api`); la pantalla de
login explica cómo crearlo. El token se valida contra GitLab desde el navegador
y se guarda **solo en esa pestaña** (`sessionStorage`): al cerrarla hay que
volver a pegarlo (el gestor de contraseñas del navegador puede rellenarlo).
Cerrar sesión lo borra; no lo revoca. Una llave SSH no sirve: solo autentica
git, no la API.

**Permiso de red local.** Dentro de la VPN, `project.comsatel.com.pe` resuelve a
una IP privada (`192.168.1.251`). Chrome y Edge (Local Network Access) piden
permiso la primera vez que una web pública accede a la red local: hay que
**permitirlo**. Si se deniega, o una política de la empresa lo impide, el
navegador bloquea la petición (en la consola: `net::ERR_BLOCKED_BY_CLIENT` o
similar). El permiso se puede cambiar en el candado de la barra de direcciones.

Sin VPN o sin ese permiso, el login y el panel dicen: "No se alcanza GitLab.
¿Estás conectado a la VPN? Si el navegador pregunta si este sitio puede acceder
a tu red local, permítelo."

## 2. Qué construye Vercel

`vercel.json`: `buildCommand` = `npm run build:web`, que empaqueta
`src/web/navegador.ts` en `public/panel.js` con esbuild (la misma lógica que
usan el escritorio y `npm run web`). No hay funciones, ni `SESSION_SECRET`, ni
variables obligatorias: `GITLAB_URL` es opcional (por defecto
`https://project.comsatel.com.pe`) y se fija al compilar.

`index.html` y `login.html` detectan el modo: si `/api/me` da 404 (como en
Vercel), usan `panel.js`; con servidor (escritorio, `npm run web`) siguen como
siempre.

## 3. Desplegar

### Opción A — desde tu máquina

```bash
npx vercel --prod --yes
```

La primera vez crea el proyecto y genera `.vercel/project.json` (ignorado por
git) con los identificadores que necesita el CI.

### Opción B — desde un repo, con GitLab CI

**La integración directa de Vercel con Git no sirve con GitLab autoalojado**:
necesita webhooks y clonado, y solo funciona con gitlab.com. El archivo
[.gitlab-ci.yml](.gitlab-ci.yml) construye en el pipeline y sube el resultado:

| Rama | Qué hace |
|---|---|
| `main` / `master` | Despliega a producción |
| `develop`, ramas `*_Feature_*` | Despliega una vista previa |
| Cualquiera | Verifica tipos y el paquete antes de desplegar |

Variables en **Settings → CI/CD → Variables** (*Masked* y *Protected*):

| Variable | De dónde sale |
|---|---|
| `VERCEL_TOKEN` | vercel.com/account/tokens |
| `VERCEL_ORG_ID` | `.vercel/project.json` tras el despliegue local |
| `VERCEL_PROJECT_ID` | idem |

Sin `VERCEL_TOKEN`, los jobs de despliegue **no se ejecutan** en vez de fallar.

## Cómo se protege el token

- Solo en `sessionStorage` de la pestaña: nunca en cookies, `localStorage`, la
  URL ni registros.
- Cabecera **Content-Security-Policy** en todas las rutas: el navegador solo
  deja conectar con la propia página y con `https://project.comsatel.com.pe`, y
  cargar imágenes propias. Aunque se inyectara código, no podría enviar el token
  a otro servidor.
- `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, `nosniff`.
- Todo texto que llega de GitLab se escapa antes de mostrarse.

## Las notificaciones

Sin servidor, el navegador guarda el estado de la vuelta anterior en
`localStorage`, compara con la misma función que la app de escritorio y muestra
solo lo nuevo. El historial es **por navegador** y se borra al cerrar sesión.

## Lo que conviene tener presente

**La URL de Vercel es pública**, pero sin VPN no sirve de nada: la página no
llega a GitLab. Con VPN, cada quien ve solo lo suyo con su propio token.

**Cada navegador hace sus consultas**: unas 100–200 cada 5 minutos por persona
con el panel abierto, igual que hacía el servidor.

**El despliegue no incluye nada de la app de escritorio**: `.vercelignore`
excluye `src/desktop/`, `dist/`, `release*/` y el `.env`. La instalación usa
`--ignore-scripts` para no descargar el binario de Electron.
