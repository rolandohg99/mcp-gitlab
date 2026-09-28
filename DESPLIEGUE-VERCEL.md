# Desplegar el panel en Vercel

El panel web corre en Vercel como funciones serverless. GitLab **sí** es
accesible desde internet (verificado: una petición desde fuera de la red de
Comsatel devuelve `401`, no un timeout), así que las funciones pueden
consultarlo.

## 1. Registrar la aplicación OAuth

En GitLab: **Preferences → Applications**

| Campo | Valor |
|---|---|
| Name | `Panel Comsatel` |
| Redirect URI | `https://TU-DOMINIO.vercel.app/api/auth/callback` |
| Confidential | marcado |
| Scopes | `read_api` |

La URI de redirección se compara carácter por carácter. Si aún no conoces el
dominio, despliega primero, copia el que asigne Vercel y edita la aplicación.

## 2. Variables de entorno en Vercel

En **Settings → Environment Variables**:

| Variable | Valor |
|---|---|
| `GITLAB_URL` | `https://project.comsatel.com.pe` |
| `OAUTH_CLIENT_ID` | Application ID de GitLab |
| `OAUTH_CLIENT_SECRET` | Secret de GitLab |
| `OAUTH_SCOPE` | `read_api` |
| `SESSION_SECRET` | 32+ caracteres aleatorios |

Genera el secreto de sesión con:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Si cambias `SESSION_SECRET`, todas las sesiones abiertas dejan de ser
válidas** — la cookie deja de poder descifrarse. Es la forma de expulsar a
todo el mundo si hiciera falta.

## 3. Desplegar

### Opción A — desde tu máquina

```bash
npx vercel --prod
```

La primera vez crea el proyecto y genera `.vercel/project.json` (ignorado por
git) con los identificadores que necesita el CI.

### Opción B — desde un repo, con GitLab CI

**La integración directa de Vercel con Git no sirve con GitLab autoalojado**:
necesita configurar webhooks y clonar el repositorio, y eso solo funciona con
gitlab.com. La propia documentación de Vercel remite a GitLab Pipelines para
instancias self-managed.

El archivo [.gitlab-ci.yml](.gitlab-ci.yml) ya implementa esa vía:

| Rama | Qué hace |
|---|---|
| `main` / `master` | Despliega a producción |
| `develop`, ramas `*_Feature_*` | Despliega una vista previa |
| Cualquiera | Verifica tipos antes de desplegar |

Variables a definir en **Settings → CI/CD → Variables**, marcadas *Masked* y
*Protected*:

| Variable | De dónde sale |
|---|---|
| `VERCEL_TOKEN` | vercel.com/account/tokens |
| `VERCEL_ORG_ID` | `.vercel/project.json` tras el despliegue local |
| `VERCEL_PROJECT_ID` | idem |

Sin `VERCEL_TOKEN` definido, los jobs de despliegue **no se ejecutan** en vez de
fallar — así el repo se puede clonar y usar sin configurar nada.

Detalle que quizá te interese: `vercel build` compila **dentro de tu pipeline** y
`vercel deploy --prebuilt` sube solo el resultado. **El código fuente nunca llega
a Vercel.**

## Cómo funciona la sesión

No hay servidor con memoria: en serverless cada petición puede caer en una
instancia distinta y efímera. El token de GitLab viaja **cifrado con AES-256-GCM
dentro de la propia cookie**, que es `HttpOnly`, `Secure` y `SameSite=Lax`.

- El navegador solo ve bytes opacos; sin `SESSION_SECRET` no puede leerlos.
- GCM detecta cualquier manipulación: una cookie alterada se rechaza.
- Caduca a las 8 horas, validado al descifrar y no solo por el navegador.
- Ocupa ~236 bytes, muy por debajo del límite de 4 KB.

## Las notificaciones

El servidor no guarda historial. El navegador manda el estado de la vuelta
anterior (guardado en `localStorage`), el servidor compara con la misma función
que usa la app de escritorio y devuelve solo lo nuevo. La lista de avisos vive
en el navegador y se borra al cerrar sesión.

Consecuencia: el historial es **por navegador**. Si entras desde otro equipo,
empieza vacío.

## Lo que conviene tener presente

**La URL de Vercel es pública.** Cualquiera en internet llega a la pantalla de
login. Los datos siguen protegidos —hay que autenticarse contra GitLab y cada
quien ve solo lo suyo— pero el panel deja de estar oculto tras la red interna.

**El despliegue no incluye nada de la app de escritorio**: `.vercelignore`
excluye `src/desktop/`, `dist/`, `release*/` y el `.env`.

**La instalación usa `--ignore-scripts`** para que Vercel no descargue el
binario de Electron (150 MB inútiles en un despliegue web).
