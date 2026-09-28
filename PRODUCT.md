# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Desarrolladores de Comsatel que trabajan en el producto SIGO sobre el GitLab
self-managed de la empresa (project.comsatel.com.pe). Lo abren varias veces al
día, en su puesto, para saber qué atender: issues asignados, merge requests que
esperan su revisión, pipelines rotos y horas pendientes de registrar.

## Product Purpose

Reunir en una sola pantalla el trabajo diario del desarrollador en GitLab y avisar
de lo que cambia, para no tener que recorrer proyecto por proyecto. El éxito es
que, en segundos, el usuario sepa qué está roto, qué espera por él y si su
registro de horas está al día.

## Positioning

Está hecho a la medida de SIGO: descubre los repositorios del grupo
`comsatel/development/products/sigo`, los agrupa por su carpeta real, sigue los
despliegues por entorno (QA, dev, pre, prod) y mide las horas contra la jornada
de 9 h de Comsatel.

## Operating Context

- Tres formas de uso con la misma interfaz: app de escritorio (Electron, Windows;
  macOS pendiente de compilar en un Mac), servidor local y web en Vercel con
  inicio de sesión OAuth de GitLab.
- La app de escritorio entra con un token personal `read_api`, guardado cifrado
  en el equipo; la web usa una cookie de sesión cifrada.
- Notificaciones cada 5 minutos: issue nuevo, MR para revisar, aprobado o
  fusionado, pipeline roto, despliegues, To-Do, horas sin registrar y nueva
  versión de la app.
- Actualizaciones anunciadas con un manifiesto en `sigo/collaboration`.

## Capabilities and Constraints

- Solo lectura sobre GitLab: el panel nunca modifica datos.
- Cada persona ve únicamente sus propios datos.
- GitLab 14.2.1: algunas APIs modernas no existen.
- Interfaz en español (es-PE).
- Sin recursos externos en tiempo de ejecución: ni fuentes, ni iconos, ni
  imágenes de terceros. Todo va incluido en los archivos de `public/`.
- Los servidores solo sirven `index.html`, `login.html`, `token.html` y
  `app.css`; cualquier recurso nuevo va incrustado en esos archivos.
- La funcionalidad existente se conserva: secciones, filtros, notificaciones,
  cierre de sesión y detección de servidor caído.

## Brand Commitments

- Nombre: "Panel de desarrollo SIGO".
- Tema oscuro, confirmado por el usuario.
- Sin logotipo corporativo definido. No se usa el logotipo de GitLab.

## Evidence on Hand

Datos reales de GitLab en tiempo de ejecución. No hay capturas, testimonios ni
métricas de uso; no se deben inventar.

## Product Principles

1. Lo roto primero: lo que exige acción se ve antes que lo que está bien.
2. Silencio cuando todo va bien: el color y la insistencia se reservan para lo
   que pide atención.
3. Un vistazo basta: cada dato tiene un lugar fijo y se lee sin abrir nada.
4. Nunca bloquear: una sección lenta o con error no impide ver las demás.
5. Confianza: solo lectura, sin secretos a la vista y sin recursos de terceros.

## Accessibility & Inclusion

WCAG 2.2 AA: contraste de texto de 4.5:1, controles e indicadores de 3:1, foco
visible con teclado, controles táctiles de 44 px y respeto de
`prefers-reduced-motion`.
