---
name: gitlab-issues
description: Crear y gestionar issues en el GitLab de Comsatel (project.comsatel.com.pe) a partir de una descripcion en lenguaje natural. Usar cuando el usuario pida crear un issue, reportar un bug, registrar una tarea o feature, listar/cerrar/comentar issues, o mencione "ticket", "issue" o "GitLab".
---

# Issues de GitLab

Convierte una descripcion informal en un issue bien formado y lo crea via el
servidor MCP `gitlab`. El objetivo es que el usuario escriba una frase y salga
un issue con titulo claro, descripcion estructurada y labels reales.

## Flujo

1. **Identifica el proyecto.** Si el usuario no lo nombra, usa el default del
   `.env`. Si nombra algo ambiguo ("el de facturacion"), resuelvelo con
   `gitlab_search_projects` y confirma el path exacto antes de seguir.

2. **Clasifica el tipo** a partir de lo que describe el usuario:
   - *bug* — algo falla, error, no funciona, se cae, comportamiento inesperado
   - *feature* — funcionalidad nueva, "agregar", "que permita"
   - *tarea* — trabajo tecnico: refactor, actualizar dependencia, configurar, documentar

3. **Consulta labels reales** con `gitlab_list_labels` antes de crear.
   GitLab crea labels nuevas en silencio si mandas una que no existe, asi que
   nunca inventes: elige entre las que devuelve la herramienta. Si ninguna
   encaja, crea el issue sin labels y avisa al usuario.

4. **Redacta el issue** siguiendo la plantilla correspondiente en
   `templates/` (bug.md, feature.md, tarea.md). Reglas de redaccion:
   - Titulo en imperativo o descriptivo, sin prefijos de tipo (las labels ya
     dicen el tipo), menos de 80 caracteres, especifico:
     "El login falla con SSO cuando el token expira", no "Error en login".
   - Rellena la plantilla solo con lo que el usuario dijo. Lo que no sepas,
     dejalo como `_Pendiente_` en vez de inventarlo — un issue con pasos de
     reproduccion ficticios es peor que uno incompleto.
   - Si faltan datos criticos para un bug (que pasa, donde, como reproducirlo),
     preguntalos antes de crear. Para tareas y features, con el objetivo basta.

5. **Muestra el borrador y espera confirmacion.** Un issue es visible para todo
   el equipo: nunca lo crees sin que el usuario apruebe el texto. Presenta
   titulo, labels, asignado y cuerpo, y pregunta si va asi.

6. **Crea con `gitlab_create_issue`** y devuelve la URL.

## Asignacion y milestone

Solo si el usuario lo pide. Para resolver a quien: `gitlab_list_members`
(acepta busqueda por nombre). Para el sprint activo: `gitlab_list_milestones`
y pasa el `id` numerico, no el titulo.

## Otras operaciones

- Listar / buscar: `gitlab_list_issues` con filtros de estado, labels y texto.
- Ver detalle: `gitlab_get_issue` con el numero (iid).
- Cerrar, reabrir, reetiquetar, reasignar: `gitlab_update_issue`.
- Comentar: `gitlab_comment_issue`.

Cerrar un issue tambien es visible para el equipo: confirma antes.

## Diagnostico

Si una herramienta falla con 401 o "no se pudo conectar", corre `gitlab_whoami`
y reporta lo que devuelva. Los errores comunes son token expirado (401),
token sin scope `api` (403) y path de proyecto mal escrito (404).
