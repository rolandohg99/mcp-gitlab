import type { GitLabClient } from "../gitlab/client.js";
import { diaDeSemana, enZona, sumarDias } from "./zona.js";

/** Grupo sobre el que se consultan los registros de tiempo. */
const DEFAULT_GROUP = "comsatel/development/products/sigo";

const QUERY = `
query($path: ID!, $from: Time!, $to: Time!, $after: String) {
  group(fullPath: $path) {
    timelogs(startTime: $from, endTime: $to, first: 100, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes {
        timeSpent
        spentAt
        summary
        user { username }
        issue { iid title webUrl }
      }
    }
  }
}`;

interface RawTimelog {
  timeSpent: number;
  spentAt: string;
  summary: string | null;
  user: { username: string } | null;
  issue: { iid: number; title: string; webUrl: string } | null;
}

export interface TimelogEntry {
  issue: number | null;
  titulo: string;
  url: string;
  horas: number;
  nota: string | null;
}

export interface DayTotal {
  fecha: string;
  diaSemana: string;
  horas: number;
  laborable: boolean;
  entradas: TimelogEntry[];
}

const DIAS = ["dom", "lun", "mar", "mie", "jue", "vie", "sab"];

/**
 * Dia de calendario al que pertenece un registro. Hay dos formas en `spentAt`:
 *  - `/spend 2h 2026-08-04` llega como medianoche UTC exacta: la fecha es la
 *    que escribio la persona, y pasarla a UTC-5 la correria al dia anterior.
 *  - `/spend 2h` sin fecha llega con la hora real en UTC: hay que llevarla a la
 *    zona de la jornada, o lo registrado despues de las 19:00 de Lima caeria
 *    en el dia siguiente.
 */
function fechaDe(spentAt: string): string {
  if (/T00:00:00(?:\.0+)?(?:Z|[+-]00:?00)?$/.test(spentAt)) return spentAt.slice(0, 10);
  const instante = new Date(spentAt);
  return Number.isNaN(instante.getTime()) ? spentAt.slice(0, 10) : enZona(instante).fecha;
}

function nombreDia(fecha: string): { dia: string; laborable: boolean } {
  const dow = diaDeSemana(fecha);
  return { dia: DIAS[dow]!, laborable: dow >= 1 && dow <= 5 };
}

async function fetchAll(
  client: GitLabClient,
  group: string,
  from: Date,
  to: Date
): Promise<RawTimelog[]> {
  const nodes: RawTimelog[] = [];
  let after: string | null = null;

  // Tope de paginas: el grupo entero puede tener miles de registros y solo
  // necesitamos la ventana reciente.
  for (let page = 0; page < 15; page++) {
    const data: any = await client.graphql(QUERY, {
      path: group,
      from: from.toISOString(),
      to: to.toISOString(),
      after
    });
    const conn = data?.group?.timelogs;
    if (!conn) break;
    nodes.push(...(conn.nodes ?? []));
    if (!conn.pageInfo?.hasNextPage) break;
    after = conn.pageInfo.endCursor;
  }

  return nodes;
}

export interface TimelogReport {
  usuario: string;
  grupo: string;
  desde: string;
  hasta: string;
  dias: DayTotal[];
  totalHoras: number;
  horasHoy: number;
  horasSemana: number;
  diasLaborablesSinRegistro: string[];
  totalEquipoHoras: number;
}

/** Mayor ventana que ofrece el panel; lo que pase de aqui es abuso o error. */
const MAX_DIAS = 90;

/**
 * `dias` llega de la query string (`?dias=`): sin acotar, `?dias=1e7` armaria
 * una serie de diez millones de dias. Lo que no sea numero cae al valor por
 * defecto; lo que se salga del rango se recorta.
 */
function ventanaValida(dias: number | undefined): number {
  if (dias === undefined || !Number.isFinite(dias)) return 14;
  return Math.min(MAX_DIAS, Math.max(1, Math.floor(dias)));
}

export async function buildTimelogReport(
  client: GitLabClient,
  username: string,
  opciones: { dias?: number; group?: string } = {}
): Promise<TimelogReport> {
  const diasVentana = ventanaValida(opciones.dias);
  const group = opciones.group ?? process.env.TIMELOG_GROUP?.trim() ?? DEFAULT_GROUP;

  // La ventana se cuenta en dias de Lima. La consulta arranca a medianoche UTC
  // del primer dia: cubre tanto los registros con fecha (00:00Z) como los de
  // hora real, que en Lima empiezan a las 05:00Z.
  const hoy = enZona().fecha;
  const primerDia = sumarDias(hoy, -(diasVentana - 1));
  const hasta = new Date();
  const desde = new Date(`${primerDia}T00:00:00Z`);

  const todos = await fetchAll(client, group, desde, hasta);
  const mios = todos.filter((t) => t.user?.username === username);

  const porDia = new Map<string, TimelogEntry[]>();
  for (const t of mios) {
    const fecha = fechaDe(t.spentAt);
    const lista = porDia.get(fecha) ?? [];
    lista.push({
      issue: t.issue?.iid ?? null,
      titulo: t.issue?.title ?? "(sin issue)",
      url: t.issue?.webUrl ?? "",
      horas: Math.round((t.timeSpent / 3600) * 100) / 100,
      nota: t.summary
    });
    porDia.set(fecha, lista);
  }

  // Serie continua: los dias sin registro deben aparecer en cero, no faltar.
  const dias: DayTotal[] = [];
  for (let i = 0; i < diasVentana; i++) {
    const fecha = sumarDias(primerDia, i);
    const entradas = porDia.get(fecha) ?? [];
    const { dia, laborable } = nombreDia(fecha);
    dias.push({
      fecha,
      diaSemana: dia,
      laborable,
      horas: Math.round(entradas.reduce((a, e) => a + e.horas, 0) * 100) / 100,
      entradas
    });
  }

  const dow = diaDeSemana(hoy);
  const lunes = sumarDias(hoy, -(dow === 0 ? 6 : dow - 1));

  const redondear = (n: number) => Math.round(n * 100) / 100;

  return {
    usuario: username,
    grupo: group,
    desde: dias[0]?.fecha ?? hoy,
    hasta: hoy,
    dias,
    totalHoras: redondear(dias.reduce((a, d) => a + d.horas, 0)),
    horasHoy: dias.find((d) => d.fecha === hoy)?.horas ?? 0,
    horasSemana: redondear(
      dias.filter((d) => d.fecha >= lunes).reduce((a, d) => a + d.horas, 0)
    ),
    diasLaborablesSinRegistro: dias
      .filter((d) => d.laborable && d.horas === 0 && d.fecha <= hoy)
      .map((d) => d.fecha),
    totalEquipoHoras: redondear(todos.reduce((a, t) => a + t.timeSpent / 3600, 0))
  };
}
