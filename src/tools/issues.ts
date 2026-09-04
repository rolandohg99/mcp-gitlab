import { z } from "zod";
import { encodeProject, GitLabError } from "../gitlab/client.js";
import { guard, resolveProject, text, type ToolContext } from "./shared.js";

interface Issue {
  id: number;
  iid: number;
  title: string;
  description: string | null;
  state: string;
  web_url: string;
  labels: string[];
  created_at: string;
  updated_at: string;
  due_date: string | null;
  author: { username: string };
  assignees: Array<{ username: string; name: string }>;
  milestone: { title: string } | null;
}

function summarize(issue: Issue) {
  return {
    iid: issue.iid,
    titulo: issue.title,
    estado: issue.state,
    labels: issue.labels,
    asignados: issue.assignees?.map((a) => a.username) ?? [],
    milestone: issue.milestone?.title ?? null,
    vence: issue.due_date,
    url: issue.web_url
  };
}

export function registerIssueTools({ server, client, config }: ToolContext): void {
  /** Traduce usernames a los IDs numericos que exige la API de issues. */
  async function resolveAssignees(usernames: string[]): Promise<number[]> {
    const ids: number[] = [];
    for (const username of usernames) {
      const { data } = await client.get<Array<{ id: number }>>("/users", { username });
      if (!data || data.length === 0) {
        throw new GitLabError(`No existe el usuario ${username} en GitLab.`, 404);
      }
      ids.push(data[0]!.id);
    }
    return ids;
  }

  server.registerTool(
    "gitlab_create_issue",
    {
      title: "Crear issue",
      description:
        "Crea un issue en GitLab. Antes de llamar, verifica las labels con " +
        "gitlab_list_labels: una label inexistente se crea sola y ensucia el proyecto.",
      inputSchema: {
        project: z.string().optional().describe("Path o ID; por defecto el del .env"),
        title: z.string().min(1).describe("Titulo del issue"),
        description: z.string().optional().describe("Cuerpo en Markdown"),
        labels: z.array(z.string()).optional().describe("Labels existentes"),
        assignee_usernames: z
          .array(z.string())
          .optional()
          .describe("Usernames de GitLab; se resuelven a IDs automaticamente"),
        milestone_id: z.number().int().optional().describe("ID del milestone"),
        due_date: z.string().optional().describe("Fecha limite YYYY-MM-DD"),
        confidential: z.boolean().default(false)
      }
    },
    guard(async (args) => {
      const target = encodeProject(resolveProject(config, args.project));
      const assignee_ids = args.assignee_usernames?.length
        ? await resolveAssignees(args.assignee_usernames)
        : undefined;

      const { data } = await client.post<Issue>(`/projects/${target}/issues`, {
        title: args.title,
        description: args.description,
        labels: args.labels?.join(","),
        assignee_ids,
        milestone_id: args.milestone_id,
        due_date: args.due_date,
        confidential: args.confidential
      });

      return text({ creado: true, ...summarize(data) });
    })
  );

  server.registerTool(
    "gitlab_list_issues",
    {
      title: "Listar issues",
      description: "Lista issues del proyecto con filtros de estado, labels y busqueda.",
      inputSchema: {
        project: z.string().optional(),
        state: z.enum(["opened", "closed", "all"]).default("opened"),
        labels: z.array(z.string()).optional().describe("Todas deben coincidir"),
        search: z.string().optional().describe("Texto en titulo o descripcion"),
        assignee_username: z.string().optional(),
        milestone: z.string().optional().describe("Titulo del milestone"),
        limit: z.number().int().min(1).max(100).default(20)
      }
    },
    guard(async (args) => {
      const target = encodeProject(resolveProject(config, args.project));
      const issues = await client.getAll<Issue>(
        `/projects/${target}/issues`,
        {
          state: args.state === "all" ? undefined : args.state,
          labels: args.labels?.join(","),
          search: args.search,
          assignee_username: args.assignee_username,
          milestone: args.milestone,
          order_by: "updated_at"
        },
        args.limit
      );
      if (issues.length === 0) return text("Sin issues que coincidan con el filtro.");
      return text(issues.map(summarize));
    })
  );

  server.registerTool(
    "gitlab_get_issue",
    {
      title: "Ver issue",
      description: "Devuelve un issue completo, con descripcion y metadatos.",
      inputSchema: {
        project: z.string().optional(),
        iid: z.number().int().describe("Numero del issue dentro del proyecto")
      }
    },
    guard(async ({ project, iid }) => {
      const target = encodeProject(resolveProject(config, project));
      const { data } = await client.get<Issue>(`/projects/${target}/issues/${iid}`);
      return text({
        ...summarize(data),
        autor: data.author.username,
        descripcion: data.description
      });
    })
  );

  server.registerTool(
    "gitlab_update_issue",
    {
      title: "Actualizar issue",
      description:
        "Modifica un issue existente: titulo, descripcion, labels, asignados, " +
        "milestone, o lo cierra/reabre con state_event.",
      inputSchema: {
        project: z.string().optional(),
        iid: z.number().int(),
        title: z.string().optional(),
        description: z.string().optional().describe("Reemplaza la descripcion completa"),
        add_labels: z.array(z.string()).optional(),
        remove_labels: z.array(z.string()).optional(),
        assignee_usernames: z
          .array(z.string())
          .optional()
          .describe("Reemplaza la lista de asignados"),
        milestone_id: z.number().int().optional(),
        due_date: z.string().optional(),
        state_event: z.enum(["close", "reopen"]).optional()
      }
    },
    guard(async (args) => {
      const target = encodeProject(resolveProject(config, args.project));
      const assignee_ids = args.assignee_usernames
        ? await resolveAssignees(args.assignee_usernames)
        : undefined;

      const { data } = await client.put<Issue>(`/projects/${target}/issues/${args.iid}`, {
        title: args.title,
        description: args.description,
        add_labels: args.add_labels?.join(","),
        remove_labels: args.remove_labels?.join(","),
        assignee_ids,
        milestone_id: args.milestone_id,
        due_date: args.due_date,
        state_event: args.state_event
      });

      return text({ actualizado: true, ...summarize(data) });
    })
  );

  server.registerTool(
    "gitlab_comment_issue",
    {
      title: "Comentar un issue",
      description: "Agrega una nota (comentario) en Markdown a un issue.",
      inputSchema: {
        project: z.string().optional(),
        iid: z.number().int(),
        body: z.string().min(1).describe("Comentario en Markdown")
      }
    },
    guard(async ({ project, iid, body }) => {
      const target = encodeProject(resolveProject(config, project));
      const { data } = await client.post<{ id: number }>(
        `/projects/${target}/issues/${iid}/notes`,
        { body }
      );
      return text({ comentado: true, nota_id: data.id, issue: iid });
    })
  );
}
