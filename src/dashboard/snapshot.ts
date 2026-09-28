import { encodeProject, GitLabError, type GitLabClient } from "../gitlab/client.js";
import { consultarHorasDeHoy } from "./horas.js";
import { detectarProductos } from "./productos.js";
import { mapLimit, proyectosVigilados, separarRuta } from "./proyectos.js";

/**
 * Foto del estado de un usuario en un instante. El servidor no recuerda nada:
 * quien compara contra la vuelta anterior es el cliente que la pide (la app de
 * escritorio), asi cada instalacion lleva su propio hilo de notificaciones.
 */
export interface Snapshot {
  usuario: string;
  tomada: string;
  issuesAsignados: Array<{ id: number; iid: number; titulo: string; url: string }>;
  todos: Array<{ id: number; accion: string; titulo: string; autor: string; url: string }>;
  mrsReview: Array<{ id: number; iid: number; titulo: string; url: string }>;
  mrsMios: Array<{
    clave: string;
    iid: number;
    projectId: number;
    titulo: string;
    url: string;
    aprobadores: string[];
  }>;
  pipelines: Array<{
    project: string;
    /** Slug del producto: "sigo", "clocator2"… */
    producto: string;
    /** Nombre del producto tal como lo muestra GitLab. */
    productoNombre: string;
    /** Carpeta dentro del producto: "microservices", "servicios-soa/tareas"… */
    grupo: string;
    /** Nombre del repo sin la ruta. */
    nombre: string;
    id: number;
    status: string;
    ref: string;
    url: string;
    /** Jobs de la etapa `deployment`, con el entorno deducido del nombre. */
    despliegues: Array<{ entorno: string; estado: string }>;
    /** Nombres de los jobs que fallaron, para decir *qué* se rompió. */
    fallidos: string[];
  }>;
  horas: { horasHoy: number; faltan: number; completo: boolean; detalle: string; url: string } | null;
}

export async function construirSnapshot(
  client: GitLabClient,
  username: string,
  gitlabUrl: string,
  incluirHoras: boolean
): Promise<Snapshot> {
  const [issues, todosResp, review, mios, pipelines] = await Promise.all([
    client.getAll<any>("/issues", { scope: "assigned_to_me", state: "opened" }, 60).catch(() => []),
    client.get<any[]>("/todos", { state: "pending", per_page: 50 }).catch(() => ({ data: [] }) as any),
    client
      .getAll<any>("/merge_requests", { reviewer_username: username, state: "opened" }, 40)
      .catch(() => []),
    client.getAll<any>("/merge_requests", { scope: "created_by_me", state: "opened" }, 40).catch(() => []),
    pipelinesVigilados(client, username)
  ]);

  const mrsMios = [];
  for (const m of mios) {
    let aprobadores: string[] = [];
    try {
      const { data } = await client.get<any>(
        `/projects/${m.project_id}/merge_requests/${m.iid}/approvals`
      );
      aprobadores = (data.approved_by ?? []).map((a: any) => a.user?.username).filter(Boolean);
    } catch {
      // Aprobaciones no disponibles: se reporta el MR sin aprobadores.
    }
    mrsMios.push({
      clave: `${m.project_id}!${m.iid}`,
      iid: m.iid,
      projectId: m.project_id,
      titulo: m.title,
      url: m.web_url,
      aprobadores
    });
  }

  let horas: Snapshot["horas"] = null;
  if (incluirHoras) {
    try {
      const r = await consultarHorasDeHoy(client, username);
      horas = {
        ...r,
        url: `${gitlabUrl}/comsatel/development/products/sigo/collaboration/-/issues?assignee_username=${username}&state=opened`
      };
    } catch {
      // GraphQL caido: se reintenta en la siguiente vuelta.
    }
  }

  return {
    usuario: username,
    tomada: new Date().toISOString(),
    issuesAsignados: issues.map((i: any) => ({
      id: i.id,
      iid: i.iid,
      titulo: i.title,
      url: i.web_url
    })),
    todos: ((todosResp as any).data ?? []).map((t: any) => ({
      id: t.id,
      accion: t.action_name,
      titulo: t.target?.title ?? "pendiente",
      autor: t.author?.username ?? "?",
      url: t.target_url
    })),
    mrsReview: review.map((m: any) => ({
      id: m.id,
      iid: m.iid,
      titulo: m.title,
      url: m.web_url
    })),
    mrsMios,
    pipelines,
    horas
  };
}

/** "deploy to qa" -> "qa". Si el nombre no encaja, se usa tal cual. */
function entornoDe(nombreJob: string): string {
  const m = /deploy\s+to\s+(.+)/i.exec(nombreJob.trim());
  return (m?.[1] ?? nombreJob).trim();
}

/** Último pipeline de cada repo de los productos en los que trabaja `username`. */
export async function pipelinesVigilados(client: GitLabClient, username: string) {
  const productos = await detectarProductos(client, username);
  const nombres = new Map(productos.map((p) => [p.slug, p.nombre]));
  const proyectos = await proyectosVigilados(
    client,
    username,
    productos.map((p) => p.slug)
  );

  // Concurrencia 6: 20 proyectos tardan ~300 ms sin castigar la instancia.
  const filas = await mapLimit(proyectos, 6, async ({ id, path }) => {
    const ref = id || encodeProject(path);
    const { producto, grupo, nombre } = separarRuta(path);
    const productoNombre = nombres.get(producto) ?? producto;
    const vacio = {
      project: path,
      producto,
      productoNombre,
      grupo,
      nombre,
      id: 0,
      status: "sin pipelines",
      ref: "",
      url: "",
      updated_at: null as string | null,
      despliegues: [] as Array<{ entorno: string; estado: string }>,
      fallidos: [] as string[]
    };

    try {
      const { data } = await client.get<any[]>(`/projects/${ref}/pipelines`, {
        per_page: 1,
        order_by: "updated_at"
      });
      const p = data?.[0];
      if (!p) return null; // Repo sin CI: no ocupa sitio en el panel.

      let despliegues: Array<{ entorno: string; estado: string }> = [];
      let fallidos: string[] = [];
      try {
        const { data: jobs } = await client.get<any[]>(
          `/projects/${ref}/pipelines/${p.id}/jobs`,
          { per_page: 50 }
        );
        despliegues = (jobs ?? [])
          .filter((j) => String(j.stage).toLowerCase() === "deployment")
          .map((j) => ({ entorno: entornoDe(j.name), estado: j.status }));
        fallidos = (jobs ?? []).filter((j) => j.status === "failed").map((j) => j.name);
      } catch {
        // Sin permiso sobre los jobs: el pipeline se reporta igual, sin detalle.
      }

      return {
        project: path,
        producto,
        productoNombre,
        grupo,
        nombre,
        id: p.id,
        status: p.status,
        ref: p.ref,
        url: p.web_url,
        updated_at: p.updated_at ?? null,
        despliegues,
        fallidos
      };
    } catch (error) {
      // Sin acceso o sin CI: el repo no aparece, en vez de fingir un error.
      if (error instanceof GitLabError && (error.status === 403 || error.status === 404)) return null;
      return { ...vacio, status: "error" };
    }
  });

  return filas.filter((f): f is NonNullable<typeof f> => f !== null);
}
