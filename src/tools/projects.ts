import { z } from "zod";
import { encodeProject } from "../gitlab/client.js";
import { guard, resolveProject, text, type ToolContext } from "./shared.js";

interface Project {
  id: number;
  path_with_namespace: string;
  name: string;
  web_url: string;
  description: string | null;
  last_activity_at: string;
}

interface Label {
  name: string;
  color: string;
  description: string | null;
}

interface Milestone {
  id: number;
  iid: number;
  title: string;
  state: string;
  due_date: string | null;
}

interface Member {
  id: number;
  username: string;
  name: string;
  access_level: number;
}

export function registerProjectTools({ server, client, config }: ToolContext): void {
  server.registerTool(
    "gitlab_search_projects",
    {
      title: "Buscar proyectos",
      description:
        "Busca proyectos accesibles por nombre o path. Usalo para resolver el " +
        "path exacto (grupo/subgrupo/proyecto) antes de crear issues.",
      inputSchema: {
        search: z.string().describe("Texto a buscar en nombre o path del proyecto"),
        limit: z.number().int().min(1).max(50).default(10)
      }
    },
    guard(async ({ search, limit }) => {
      const projects = await client.getAll<Project>(
        "/projects",
        { search, membership: true, order_by: "last_activity_at", simple: true },
        limit
      );
      if (projects.length === 0) {
        return text(`Sin resultados para "${search}". Revisa permisos del token.`);
      }
      return text(
        projects.map((p) => ({
          id: p.id,
          path: p.path_with_namespace,
          name: p.name,
          url: p.web_url,
          ultima_actividad: p.last_activity_at
        }))
      );
    })
  );

  server.registerTool(
    "gitlab_list_labels",
    {
      title: "Listar labels del proyecto",
      description:
        "Devuelve las labels existentes. Consultalo ANTES de crear un issue: " +
        "GitLab crea labels nuevas silenciosamente si mandas una que no existe.",
      inputSchema: {
        project: z.string().optional().describe("Path o ID; por defecto el del .env")
      }
    },
    guard(async ({ project }) => {
      const target = encodeProject(resolveProject(config, project));
      const labels = await client.getAll<Label>(`/projects/${target}/labels`, {}, 200);
      return text(
        labels.map((l) => ({ name: l.name, description: l.description }))
      );
    })
  );

  server.registerTool(
    "gitlab_list_milestones",
    {
      title: "Listar milestones",
      description: "Milestones/sprints del proyecto, para asignarlos a un issue.",
      inputSchema: {
        project: z.string().optional(),
        state: z.enum(["active", "closed", "all"]).default("active")
      }
    },
    guard(async ({ project, state }) => {
      const target = encodeProject(resolveProject(config, project));
      const query = state === "all" ? {} : { state };
      const milestones = await client.getAll<Milestone>(
        `/projects/${target}/milestones`,
        query,
        100
      );
      return text(
        milestones.map((m) => ({
          id: m.id,
          title: m.title,
          state: m.state,
          vence: m.due_date
        }))
      );
    })
  );

  server.registerTool(
    "gitlab_list_members",
    {
      title: "Listar miembros del proyecto",
      description:
        "Miembros con acceso al proyecto, para resolver a quien asignar un issue.",
      inputSchema: {
        project: z.string().optional(),
        search: z.string().optional().describe("Filtra por nombre o username")
      }
    },
    guard(async ({ project, search }) => {
      const target = encodeProject(resolveProject(config, project));
      const members = await client.getAll<Member>(
        `/projects/${target}/members/all`,
        { query: search },
        100
      );
      return text(
        members.map((m) => ({ id: m.id, username: m.username, nombre: m.name }))
      );
    })
  );

  server.registerTool(
    "gitlab_whoami",
    {
      title: "Verificar conexion y token",
      description:
        "Devuelve el usuario del token y la version de GitLab. Usalo como " +
        "diagnostico cuando algo falle.",
      inputSchema: {}
    },
    guard(async () => {
      const { data: user } = await client.get<{ username: string; name: string; id: number }>(
        "/user"
      );
      const { data: version } = await client.get<{ version: string }>("/version");
      return text({
        instancia: config.gitlabUrl,
        version: version.version,
        usuario: user.username,
        nombre: user.name,
        proyecto_por_defecto: config.defaultProject ?? "(no configurado)"
      });
    })
  );
}
