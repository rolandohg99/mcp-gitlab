import type { GitLabClient } from "../gitlab/client.js";
import { catalogo, productoDe, raizProductos } from "./productos.js";

export interface ProyectoVigilado {
  id: number;
  path: string;
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
 * Repos a vigilar: los que tienen CI dentro de los productos pedidos.
 * `DASHBOARD_PROJECTS` sigue funcionando como lista manual y tiene prioridad.
 * Sin productos no se consulta nada: no hay qué vigilar.
 */
export async function proyectosVigilados(
  client: GitLabClient,
  username: string,
  productos: string[]
): Promise<ProyectoVigilado[]> {
  const manual = process.env.DASHBOARD_PROJECTS?.trim();
  if (manual) {
    return manual
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((path) => ({ id: 0, path }));
  }
  if (!productos.length) return [];

  const buscados = new Set(productos);
  const { proyectos } = await catalogo(client, username);
  // Repos con CI deshabilitado (como el de issues) devuelven 403 al pedirles pipelines.
  return proyectos
    .filter((p) => p.jobsEnabled && p.producto !== null && buscados.has(p.producto))
    .map((p) => ({ id: p.id, path: p.path }));
}

/**
 * Parte "…/products/sigo/microservices/sigo-bff" en { producto: "sigo",
 * grupo: "microservices", nombre: "sigo-bff" }. Los subgrupos anidados se
 * conservan enteros ("servicios-soa/tareas"), porque ahí vive la distinción útil.
 */
export function separarRuta(path: string): { producto: string; grupo: string; nombre: string } {
  const raiz = raizProductos();
  const producto = productoDe(path, raiz) ?? "";
  const relativo = path.startsWith(`${raiz}/`) ? path.slice(raiz.length + 1) : path;
  const partes = relativo.split("/").filter(Boolean);
  const nombre = partes.pop() ?? path;
  if (producto) partes.shift();
  return { producto, grupo: partes.join("/") || "(sin carpeta)", nombre };
}
