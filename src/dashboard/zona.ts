/**
 * Fechas y horas en la zona de la jornada, no en la del proceso.
 *
 * Vercel ejecuta en UTC y la app de escritorio en la hora del equipo: sin una
 * zona explicita, "hoy" y "las 17:30" significan cosas distintas segun donde
 * corra el codigo. El equipo trabaja en Lima; ZONA_HORARIA permite cambiarlo.
 */
function zonaValida(): string {
  const pedida = process.env.ZONA_HORARIA?.trim() || "America/Lima";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: pedida });
    return pedida;
  } catch {
    // Zona mal escrita: mejor Lima que reventar en cada consulta.
    return "America/Lima";
  }
}

export const ZONA = zonaValida();

const FORMATO = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23"
});

export interface Momento {
  /** YYYY-MM-DD en la zona de la jornada. */
  fecha: string;
  /** 0 = domingo … 6 = sabado. */
  diaSemana: number;
  hora: number;
  minuto: number;
}

export function enZona(d: Date = new Date()): Momento {
  const p = Object.fromEntries(FORMATO.formatToParts(d).map((x) => [x.type, x.value]));
  const fecha = `${p.year}-${p.month}-${p.day}`;
  return { fecha, diaSemana: diaDeSemana(fecha), hora: Number(p.hour), minuto: Number(p.minute) };
}

/** Dia de la semana de una fecha YYYY-MM-DD, sin depender de la zona del proceso. */
export function diaDeSemana(fecha: string): number {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
}

/** Suma (o resta) dias de calendario a una fecha YYYY-MM-DD. */
export function sumarDias(fecha: string, dias: number): string {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + dias)).toISOString().slice(0, 10);
}
