import type { GitLabClient } from "../gitlab/client.js";

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
 * Agrupa por la parte de fecha de `spentAt` en UTC, sin convertir a hora local:
 * los registros hechos con `/spend 2h 2026-08-04` llegan como medianoche UTC y
 * pasarlos a UTC-5 los correria al dia anterior.
 */
function fechaDe(spentAt: string): string {
  return spentAt.slice(0, 10);
}

function nombreDia(fecha: string): { dia: string; laborable: boolean } {
  const [y, m, d] = fecha.split("-").map(Number);
  const dow = new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
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

export async function buildTimelogReport(
  client: GitLabClient,
  username: string,
  opciones: { dias?: number; group?: string } = {}
): Promise<TimelogReport> {
  const diasVentana = opciones.dias ?? 14;
  const group = opciones.group ?? process.env.TIMELOG_GROUP?.trim() ?? DEFAULT_GROUP;

  const hasta = new Date();
  const desde = new Date(hasta.getTime() - (diasVentana - 1) * 86400000);
  desde.setUTCHours(0, 0, 0, 0);

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
    const d = new Date(desde.getTime() + i * 86400000);
    const fecha = d.toISOString().slice(0, 10);
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

  const hoy = new Date().toISOString().slice(0, 10);
  const inicioSemana = new Date();
  const dow = inicioSemana.getUTCDay();
  inicioSemana.setUTCDate(inicioSemana.getUTCDate() - (dow === 0 ? 6 : dow - 1));
  const lunes = inicioSemana.toISOString().slice(0, 10);

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
