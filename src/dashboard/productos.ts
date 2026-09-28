import { encodeProject, type GitLabClient } from "../gitlab/client.js";
import { enZona, sumarDias } from "./zona.js";

/**
 * Productos de Comsatel y detección de en cuáles trabaja cada persona.
 *
 * Un producto es un subgrupo de primer nivel bajo la raíz (sigo, clocator2…).
 * Se descubren consultando GitLab: un producto nuevo aparece solo.
 */

const RAIZ_POR_DEFECTO = "comsatel/development/products";

/** El catálogo cambia muy rara vez; se relee cada media hora. */
const TTL_CATALOGO_MS = 30 * 60 * 1000;
/** La detección cuesta ~3 s (eventos); una hora de caché basta. */
const TTL_DETECCION_MS = 60 * 60 * 1000;
/** Ventana de actividad que cuenta para detectar un producto. */
const DIAS_EVENTOS = 30;
/** Eventos mínimos para que un producto cuente sin issues ni MRs abiertos. */
const MIN_EVENTOS = 5;
/**
 * /events es la señal opcional: si tarda más, se sigue sin ella. Medido en
 * frío hasta 5 s (tres páginas); 10 s deja margen y corre en paralelo con el
 * catálogo, que ya tarda ~6,6 s.
 */
const TIMEOUT_EVENTOS_MS = 10_000;
/** Sin eventos la detección es peor: se reintenta pronto en vez de fijarla una hora. */
const TTL_DEGRADADO_MS = 5 * 60 * 1000;

/** `valor` y si llegó a tiempo; si `promesa` falla o tarda, `porDefecto` y false. */
function conTope<T>(promesa: Promise<T>, ms: number, porDefecto: T): Promise<{ valor: T; aTiempo: boolean }> {
  return new Promise((ok) => {
    const reloj = setTimeout(() => ok({ valor: porDefecto, aTiempo: false }), ms);
    promesa.then(
      (valor) => {
        clearTimeout(reloj);
        ok({ valor, aTiempo: true });
      },
      () => {
        clearTimeout(reloj);
        ok({ valor: porDefecto, aTiempo: false });
      }
    );
  });
}

export interface Producto {
  slug: string;
  nombre: string;
}

export interface ProyectoCatalogo {
  id: number;
  path: string;
  /** null: el repo vive en la raíz o fuera de ella, no en un producto. */
  producto: string | null;
  jobsEnabled: boolean;
}

export interface Catalogo {
  productos: Producto[];
  proyectos: ProyectoCatalogo[];
}

type Conteos = Record<string, { abiertos: number; eventos: number }>;

export function raizProductos(): string {
  return (process.env.PRODUCTS_GROUP?.trim() || RAIZ_POR_DEFECTO).replace(/\/+$/, "");
}

/** "…/products/sigo/microservices/bff" → "sigo". Un repo en la raíz no es de ningún producto. */
export function productoDe(path: string, raiz = raizProductos()): string | null {
  if (!path.startsWith(`${raiz}/`)) return null;
  const partes = path.slice(raiz.length + 1).split("/").filter(Boolean);
  return partes.length >= 2 ? partes[0]! : null;
}

// Cachés por usuario: cada token ve proyectos distintos según sus permisos, y
// la web es multiusuario. Compartirlas mezclaría lo que ve cada uno.
const catalogos = new Map<string, { hasta: number; datos: Catalogo }>();
const detecciones = new Map<string, { hasta: number; productos: Producto[] }>();

export function invalidarCaches(): void {
  catalogos.clear();
  detecciones.clear();
}

export async function catalogo(client: GitLabClient, username: string): Promise<Catalogo> {
  const guardado = catalogos.get(username);
  if (guardado && Date.now() < guardado.hasta) return guardado.datos;

  const raiz = raizProductos();
  const grupo = encodeProject(raiz);
  const [subgrupos, crudos] = await Promise.all([
    client.getAll<any>(`/groups/${grupo}/subgroups`, {}, 100),
    // Sin `simple`: hace falta `jobs_enabled` para saltar repos sin CI.
    client.getAll<any>(`/groups/${grupo}/projects`, { include_subgroups: true }, 1000)
  ]);

  const datos: Catalogo = {
    productos: subgrupos.map((g) => ({ slug: g.path, nombre: g.name ?? g.path })),
    proyectos: crudos.map((p) => ({
      id: p.id,
      path: p.path_with_namespace,
      producto: productoDe(p.path_with_namespace, raiz),
      jobsEnabled: p.jobs_enabled !== false
    }))
  };
  catalogos.set(username, { hasta: Date.now() + TTL_CATALOGO_MS, datos });
  return datos;
}

/** Suma actividad por producto. Proyectos desconocidos o sin producto no cuentan. */
export function contarActividad(
  proyectoAProducto: Map<number, string | null>,
  abiertos: number[],
  eventos: number[]
): Conteos {
  const conteos: Conteos = {};
  const sumar = (id: number, campo: "abiertos" | "eventos") => {
    const producto = proyectoAProducto.get(id);
    if (!producto) return;
    conteos[producto] ??= { abiertos: 0, eventos: 0 };
    conteos[producto][campo]++;
  };
  for (const id of abiertos) sumar(id, "abiertos");
  for (const id of eventos) sumar(id, "eventos");
  return conteos;
}

/**
 * Un producto cuenta si hay algo abierto en él o actividad sostenida. El
 * umbral de eventos descarta visitas puntuales (un comentario suelto).
 */
export function elegirProductos(conteos: Conteos): string[] {
  const total = (s: string) => conteos[s]!.abiertos + conteos[s]!.eventos;
  return Object.keys(conteos)
    .filter((s) => conteos[s]!.abiertos >= 1 || conteos[s]!.eventos >= MIN_EVENTOS)
    .sort((a, b) => total(b) - total(a) || a.localeCompare(b));
}

function conNombre(slugs: string[], productos: Producto[]): Producto[] {
  const nombres = new Map(productos.map((p) => [p.slug, p.nombre]));
  return slugs.map((slug) => ({ slug, nombre: nombres.get(slug) ?? slug }));
}

/** Productos en los que trabaja `username`, o los de DASHBOARD_PRODUCTS si está definido. */
export async function detectarProductos(
  client: GitLabClient,
  username: string,
  opciones: { timeoutEventosMs?: number; ttlDegradadoMs?: number } = {}
): Promise<Producto[]> {
  const manual = process.env.DASHBOARD_PRODUCTS?.split(",").map((s) => s.trim()).filter(Boolean);
  if (manual?.length) {
    const productos = await catalogo(client, username).then((c) => c.productos).catch(() => []);
    return conNombre(manual, productos);
  }

  const guardada = detecciones.get(username);
  if (guardada && Date.now() < guardada.hasta) return guardada.productos;

  try {
    const desde = sumarDias(enZona().fecha, -DIAS_EVENTOS);
    // Cada señal falla por su cuenta: sin eventos, bastan issues y MRs abiertos.
    const [cat, issues, mios, revision, eventosTope] = await Promise.all([
      catalogo(client, username),
      client.getAll<any>("/issues", { scope: "assigned_to_me", state: "opened" }, 60).catch(() => []),
      client.getAll<any>("/merge_requests", { scope: "created_by_me", state: "opened" }, 40).catch(() => []),
      // Sin scope, GitLab aplica created_by_me y esconde los MRs de otros.
      client
        .getAll<any>("/merge_requests", { reviewer_username: username, state: "opened", scope: "all" }, 40)
        .catch(() => []),
      conTope(
        client.getAll<any>("/events", { after: desde }, 300),
        opciones.timeoutEventosMs ?? TIMEOUT_EVENTOS_MS,
        [] as any[]
      )
    ]);

    const mapa = new Map(cat.proyectos.map((p) => [p.id, p.producto]));
    const conteos = contarActividad(
      mapa,
      [...issues, ...mios, ...revision].map((x) => x.project_id),
      eventosTope.valor.map((e) => e.project_id)
    );
    const productos = conNombre(elegirProductos(conteos), cat.productos);
    const ttl = eventosTope.aTiempo
      ? TTL_DETECCION_MS
      : (opciones.ttlDegradadoMs ?? TTL_DEGRADADO_MS);
    detecciones.set(username, { hasta: Date.now() + ttl, productos });
    return productos;
  } catch (error) {
    // Catálogo inaccesible: mejor la última detección, aunque esté vencida.
    // Sin ella se propaga el error: una lista vacía se leería como "no
    // trabajas en nada" y dejaría horas en cero y avisos falsos.
    if (guardada) return guardada.productos;
    throw error;
  }
}
