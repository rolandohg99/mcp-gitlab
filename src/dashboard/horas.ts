import type { GitLabClient } from "../gitlab/client.js";
import { buildTimelogReport } from "./timelogs.js";

/** Jornada esperada por dia laborable, en horas. */
export const JORNADA = 9;

/** Fecha local en YYYY-MM-DD; `toISOString` daria el dia UTC y en Lima adelanta. */
export function fechaLocal(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface ResumenHoras {
  horasHoy: number;
  faltan: number;
  completo: boolean;
  detalle: string;
}

/** Horas registradas hoy. Ventana corta: es la consulta mas cara del ciclo. */
export async function consultarHorasDeHoy(
  client: GitLabClient,
  username: string
): Promise<ResumenHoras> {
  const reporte = await buildTimelogReport(client, username, { dias: 3 });
  const dia = reporte.dias.find((d) => d.fecha === fechaLocal());
  const horasHoy = dia?.horas ?? 0;

  return {
    horasHoy,
    faltan: Math.max(0, JORNADA - horasHoy),
    completo: horasHoy >= JORNADA,
    detalle: (dia?.entradas ?? []).map((e) => `${e.horas} h · ${e.titulo}`).join("\n")
  };
}
