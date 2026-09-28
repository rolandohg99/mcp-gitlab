---
name: kubernetes-qa
description: Diagnosticar y operar el clúster de Kubernetes de QA de Comsatel a través del bastión SSH. Usar cuando el usuario pregunte por pods, logs, despliegues, releases de Helm, por qué un servicio no levanta o está caído, o mencione Kubernetes, kubectl, helm, QA, namespace o pods.
---

# Kubernetes de QA

Operación del clúster de pruebas mediante las herramientas `k8s_*` y `helm_*`,
que ejecutan `kubectl` y `helm` en el bastión por SSH.

## Norma que manda sobre todo lo demás

**No ejecutes ninguna herramienta sin autorización explícita del usuario.**
Ni siquiera las de lectura.

Ante cualquier petición: entrega el análisis, las opciones y el comando exacto
que propones, y **espera el visto bueno**. El usuario ejecuta o autoriza; tú no
te adelantas. Esto lo pidió él de forma expresa y no admite excepciones por
urgencia, por obviedad ni porque la operación parezca inofensiva.

Si hace falta un dato del clúster para responder, dilo y propón la consulta —
no la lances por tu cuenta.

Además, el clúster está en **modo solo lectura** por defecto
(`K8S_SOLO_LECTURA=true`): las herramientas que modifican se niegan a ejecutarse
hasta que el usuario cambie esa variable. Es una barrera del código, no un
recordatorio — no intentes rodearla.

## Lo primero: es un entorno compartido

QA es donde prueba el resto del equipo. Un reinicio a destiempo o un escalado a
cero deja a gente bloqueada sin que sepan por qué. Eso condiciona todo lo demás:
**diagnosticar es gratis, actuar no.**

## Diagnóstico antes que acción

Ante "X no funciona", el camino es siempre el mismo:

1. `k8s_pods` con `problemas: true` — ver qué no está Running.
2. `k8s_describe` sobre el pod — los eventos del final explican la mayoría de
   los casos: imagen que no se descarga, sonda que falla, recursos insuficientes.
3. `k8s_logs` — y si el pod está en CrashLoopBackOff, **con `anterior: true`**:
   los logs del contenedor que murió son los que tienen la causa; los del actual
   suelen estar vacíos porque acaba de arrancar.
4. `k8s_eventos` con `solo_avisos: true` — qué pasó justo antes.

Solo después de entender qué ocurre se plantea una acción.

## Antes de modificar nada

**Presenta lo que encontraste y qué propones hacer, y espera confirmación.**
Aunque la herramienta pida permiso por su cuenta, ese diálogo no explica el
contexto: quien aprueba merece saber qué se rompió y por qué esa acción lo
arregla.

Para `k8s_borrar` y `k8s_aplicar`, **ejecuta primero con `simulacion: true`**,
enseña la salida y solo entonces pregunta si se aplica de verdad.

Antes de un rollback, consulta `helm_historial` o el historial del deployment:
hay que saber a qué versión se vuelve, no solo que se vuelve.

## Qué herramienta usar

| Situación | Herramienta |
|---|---|
| ¿Qué hay desplegado? | `helm_releases`, `k8s_deployments` |
| Un pod no arranca | `k8s_describe` → `k8s_logs` con `anterior` |
| Réplica atascada | `k8s_borrar_pod` (el deployment la recrea) |
| Cambio de config no aplicado | `k8s_reiniciar` |
| Un despliegue rompió algo | `helm_historial` → `helm_deshacer` |
| Seguir un despliegue | `k8s_estado_despliegue` |
| Nada de lo anterior encaja | `kubectl_crudo` |

`kubectl_crudo` es la última opción, no la primera. Las herramientas
específicas validan sus argumentos; la cruda solo comprueba que el comando
empiece por `kubectl` o `helm`.

## El entorno

Los despliegues van por **Helm**, con charts en `./chart` de cada repo, y el
namespace habitual es **`applications`**. Los pipelines nombran sus entornos
`dev`, `qa`, `pre` y `prod`.

**Si aparece un namespace o release de producción, detente y pregunta.** El
acceso es al clúster de QA, pero si desde ese bastión se alcanzara producción,
ninguna herramienta lo impediría: el criterio es lo único que hay.

## Cuando falla la conexión

`k8s_conexion` es el diagnóstico: comprueba el SSH y que kubectl responda.
Los fallos habituales son credenciales incorrectas, no estar en la red o la VPN,
y que el bastión no tenga kubeconfig configurado para el usuario con el que se
entra.
