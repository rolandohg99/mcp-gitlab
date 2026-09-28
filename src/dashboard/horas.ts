import type { GitLabClient } from "../gitlab/client.js";
import { buildTimelogReport } from "./timelogs.js";
import { enZona } from "./zona.js";

/** Jornada esperada por dia laborable, en horas. */
export const JORNADA = 9;

/**
 * Fecha YYYY-MM-DD en la zona de la jornada (Lima), no en la del proceso:
 * en Vercel el proceso corre en UTC y "hoy" cambiaria a las 19:00.
 */
export function fechaLocal(d: Date = new Date()): string {
  return enZona(d).fecha;
}

export interface ResumenHoras {
  horasHoy: number;
  faltan: number;
  completo: boolean;
  detalle: string;
  parcial: boolean;
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
    detalle: (dia?.entradas ?? []).map((e) => `${e.horas} h · ${e.titulo}`).join("\n"),
    parcial: reporte.parcial
  };
}
