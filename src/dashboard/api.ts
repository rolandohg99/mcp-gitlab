import type { Config } from "../config.js";
import { encodeProject, GitLabClient } from "../gitlab/client.js";
import { pipelinesVigilados } from "./snapshot.js";

const COLLAB = "comsatel/development/products/sigo/collaboration";

/** Estados de workflow que el equipo usa como labels con scope. */
const BUG_STATES = [
  "Bug :: New",
  "Bug :: In Analysis",
  "Bug :: In Development",
  "Bug :: In Test",
  "Bug :: Done",
  "Bug :: Deployed"
];

export interface IssueRow {
  iid: number;
  title: string;
  web_url: string;
  labels: string[];
  state: string;
  milestone: string | null;
  updated_at: string;
  project: string;
  author: string;
  assignees: string[];
}

export interface MrRow {
  iid: number;
  title: string;
  web_url: string;
  source_branch: string;
  target_branch: string;
  updated_at: string;
  project: string;
  draft: boolean;
  has_conflicts: boolean;
  author: string;
}

function projectFromUrl(webUrl: string): string {
  // https://host/grupo/sub/proyecto/-/issues/1  ->  grupo/sub/proyecto
  const match = /^https?:\/\/[^/]+\/(.+?)\/-\//.exec(webUrl);
  return match?.[1] ?? "";
}

function toIssue(raw: any): IssueRow {
  return {
    iid: raw.iid,
    title: raw.title,
    web_url: raw.web_url,
    labels: raw.labels ?? [],
    state: raw.state,
    milestone: raw.milestone?.title ?? null,
    updated_at: raw.updated_at,
    project: projectFromUrl(raw.web_url),
    author: raw.author?.username ?? "",
    assignees: (raw.assignees ?? []).map((a: any) => a.username)
  };
}

function toMr(raw: any): MrRow {
  return {
    iid: raw.iid,
    title: raw.title,
    web_url: raw.web_url,
    source_branch: raw.source_branch,
    target_branch: raw.target_branch,
    updated_at: raw.updated_at,
    project: projectFromUrl(raw.web_url),
    draft: Boolean(raw.draft ?? raw.work_in_progress),
    has_conflicts: Boolean(raw.has_conflicts),
    author: raw.author?.username ?? ""
  };
}

/** Cada panel se resuelve por separado: si uno falla, el resto del dashboard sigue vivo. */
async function settle<T>(label: string, fn: () => Promise<T>): Promise<{ data: T | null; error: string | null }> {
  try {
    return { data: await fn(), error: null };
  } catch (error) {
    return { data: null, error: `${label}: ${(error as Error).message}` };
  }
}

export class DashboardApi {
  constructor(private readonly client: GitLabClient, private readonly config: Config) {}

  async me() {
    const { data } = await this.client.get<any>("/user");
    return { username: data.username, name: data.name, avatar: data.avatar_url, url: data.web_url };
  }

  async summary(username: string) {
    const collab = encodeProject(COLLAB);

    const [assigned, mrsAuthored, mrsToReview, todos, bugs, milestones] = await Promise.all([
      settle("issues asignados", async () =>
        (await this.client.getAll<any>("/issues", { scope: "assigned_to_me", state: "opened", order_by: "updated_at" }, 40)).map(toIssue)
      ),
      settle("MRs propios", async () =>
        (await this.client.getAll<any>("/merge_requests", { scope: "created_by_me", state: "opened", order_by: "updated_at" }, 30)).map(toMr)
      ),
      settle("MRs por revisar", async () =>
        (await this.client.getAll<any>("/merge_requests", { reviewer_username: username, state: "opened", order_by: "updated_at" }, 30)).map(toMr)
      ),
      settle("todos", async () => {
        const { data } = await this.client.get<any[]>("/todos", { state: "pending", per_page: 30 });
        return (data ?? []).map((t) => ({
          id: t.id,
          accion: t.action_name,
          titulo: t.target?.title ?? "(sin titulo)",
          proyecto: t.project?.path_with_namespace ?? "",
          autor: t.author?.username ?? "",
          url: t.target_url,
          created_at: t.created_at
        }));
      }),
      settle("bugs por estado", async () => {
        const counts: Array<{ estado: string; total: number; url: string }> = [];
        for (const state of BUG_STATES) {
          const { headers } = await this.client.get(`/projects/${collab}/issues`, {
            labels: state,
            state: "opened",
            per_page: 1
          });
          counts.push({
            estado: state.replace("Bug :: ", ""),
            total: Number(headers.get("x-total") ?? 0),
            url: `${this.config.gitlabUrl}/${COLLAB}/-/issues?label_name[]=${encodeURIComponent(state)}&state=opened`
          });
        }
        return counts;
      }),
      settle("milestones", async () => {
        const list = await this.client.getAll<any>(`/projects/${collab}/milestones`, { state: "active" }, 10);
        return list.map((m) => ({ id: m.id, titulo: m.title, vence: m.due_date }));
      })
    ]);

    const errors = [assigned, mrsAuthored, mrsToReview, todos, bugs, milestones]
      .map((r) => r.error)
      .filter((e): e is string => Boolean(e));

    return {
      assigned: assigned.data ?? [],
      mrsAuthored: mrsAuthored.data ?? [],
      mrsToReview: mrsToReview.data ?? [],
      todos: todos.data ?? [],
      bugs: bugs.data ?? [],
      milestones: milestones.data ?? [],
      errors,
      gitlabUrl: this.config.gitlabUrl,
      collaboration: `${this.config.gitlabUrl}/${COLLAB}`
    };
  }

  /**
   * Ultimo pipeline de cada repo vigilado, con sus jobs de despliegue. Delega
   * en la misma funcion que alimenta las notificaciones: si el panel y los
   * avisos divergieran, uno de los dos estaria mintiendo.
   */
  async pipelines(username: string) {
    return pipelinesVigilados(this.client, username);
  }

}

export { COLLAB };
