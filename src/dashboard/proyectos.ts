import { encodeProject, type GitLabClient } from "../gitlab/client.js";

/** Grupo cuyos repos se vigilan. Configurable en .env. */
const GRUPO_POR_DEFECTO = "comsatel/development/products/sigo";

/**
 * Ventana de actividad. 0 = sin límite: se vigila todo repo con CI, tenga la
 * antigüedad que tenga. El criterio real es "tiene pipeline", y eso solo se
 * sabe al consultarlo; la fecha era una heurística que escondía subgrupos
 * enteros (Rpa, mobileapps, Hibridas) por llevar tiempo quietos.
 */
const DIAS_ACTIVIDAD = 0;

/** La lista de proyectos cambia muy rara vez; se relee cada media hora. */
const TTL_CACHE_MS = 30 * 60 * 1000;

export interface ProyectoVigilado {
  id: number;
  path: string;
  ultimaActividad: string;
}

let cache: { hasta: number; proyectos: ProyectoVigilado[] } | null = null;

function diasDesde(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

/**
 * Ejecuta `fn` sobre `items` con un tope de tareas en vuelo. Sin esto, 50
 * peticiones simultaneas contra un GitLab 14.2 son una mala idea.
 */
export async function mapLimit<T, R>(
  items: T[],
  limite: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const salida: R[] = new Array(items.length);
  let siguiente = 0;
  await Promise.all(
    Array.from({ length: Math.min(limite, items.length) }, async () => {
      while (siguiente < items.length) {
        const i = siguiente++;
        salida[i] = await fn(items[i]!);
      }
    })
  );
  return salida;
}

/**
 * Lista los repos a vigilar. Por defecto los descubre del grupo, quedandose con
 * los que tuvieron actividad reciente. `DASHBOARD_PROJECTS` sigue funcionando
 * como lista manual y tiene prioridad.
 */
export async function proyectosVigilados(client: GitLabClient): Promise<ProyectoVigilado[]> {
  const manual = process.env.DASHBOARD_PROJECTS?.trim();
  if (manual) {
    return manual
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((path) => ({ id: 0, path, ultimaActividad: "" }));
  }

  if (cache && Date.now() < cache.hasta) return cache.proyectos;

  const grupo = process.env.PIPELINE_GROUP?.trim() || GRUPO_POR_DEFECTO;
  const dias = Number(process.env.PIPELINE_DIAS ?? DIAS_ACTIVIDAD);

  // Sin `simple` porque hace falta `jobs_enabled`: repos con CI deshabilitado
  // (como el de issues) devuelven 403 al pedirles pipelines.
  const crudos = await client.getAll<any>(
    `/groups/${encodeProject(grupo)}/projects`,
    { include_subgroups: true, order_by: "last_activity_at" },
    200
  );

  const proyectos = crudos
    .filter((p) => p.jobs_enabled !== false)
    .filter((p) => dias <= 0 || (p.last_activity_at && diasDesde(p.last_activity_at) <= dias))
    .map((p) => ({
      id: p.id,
      path: p.path_with_namespace,
      ultimaActividad: p.last_activity_at
    }));

  cache = { hasta: Date.now() + TTL_CACHE_MS, proyectos };
  return proyectos;
}

/**
 * Parte "…/sigo/microservices/sigo-bff" en { grupo: "microservices",
 * nombre: "sigo-bff" }. Los subgrupos anidados se conservan enteros
 * ("servicios-soa/tareas"), porque ahi vive la distincion util.
 */
export function separarRuta(path: string): { grupo: string; nombre: string } {
  const base = (process.env.PIPELINE_GROUP?.trim() || GRUPO_POR_DEFECTO).replace(/\/+$/, "") + "/";
  const relativo = path.startsWith(base) ? path.slice(base.length) : path;
  const partes = relativo.split("/").filter(Boolean);
  const nombre = partes.pop() ?? path;
  return { grupo: partes.join("/") || "(sin carpeta)", nombre };
}

/** Fuerza releer la lista en la próxima consulta. */
export function invalidarCacheProyectos(): void {
  cache = null;
}
