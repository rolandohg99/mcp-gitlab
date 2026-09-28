import { fechaLocal, JORNADA } from "./horas.js";
import type { Snapshot } from "./snapshot.js";
import { enZona } from "./zona.js";

export interface Aviso {
  tipo:
    | "issue"
    | "todo"
    | "mr-review"
    | "mr-aprobado"
    | "mr-merged"
    | "pipeline"
    | "despliegue"
    | "horas"
    | "actualizacion";
  titulo: string;
  cuerpo: string;
  url?: string;
}

export interface Estado {
  sembrado: boolean;
  issuesAsignados: number[];
  todos: number[];
  mrsReview: number[];
  mrsMios: Record<string, { iid: number; titulo: string; url: string; aprobadores: string[] }>;
  pipelines: Record<string, { id: number; status: string; despliegues: Record<string, string> }>;
  horasAvisadas: string | null;
  /** Ultima version de la que ya se aviso, para no repetir el toast. */
  versionAvisada: string | null;
}

export function estadoInicial(): Estado {
  return {
    sembrado: false,
    issuesAsignados: [],
    todos: [],
    mrsReview: [],
    mrsMios: {},
    pipelines: {},
    horasAvisadas: null,
    versionAvisada: null
  };
}

export interface OpcionesAviso {
  /** Hora local a partir de la cual recordar el registro de horas. */
  horaAvisoHoras: number;
  minutoAvisoHoras: number;
}

/**
 * Hora del recordatorio, configurable como HORA_AVISO=HH:MM. Se lee aqui y no
 * en cada cliente para que escritorio, web local y Vercel avisen a la misma hora.
 */
export function horaAvisoConfigurada(): OpcionesAviso {
  const [h, m] = (process.env.HORA_AVISO?.trim() || "17:30").split(":").map(Number);
  const valido =
    Number.isInteger(h) && h! >= 0 && h! <= 23 && Number.isInteger(m) && m! >= 0 && m! <= 59;
  return valido ? { horaAvisoHoras: h!, minutoAvisoHoras: m! } : { horaAvisoHoras: 17, minutoAvisoHoras: 30 };
}

function nuevos<T>(actuales: T[], previos: T[]): T[] {
  const set = new Set(previos);
  return actuales.filter((x) => !set.has(x));
}

/**
 * ¿Toca ya el recordatorio de horas? Solo dias laborables, una vez al dia.
 * Dia y hora se miden en la zona de la jornada, no en la del proceso.
 */
export function tocaAvisoDeHoras(previo: Estado, opciones: Partial<OpcionesAviso> = {}): boolean {
  const cfg = { ...horaAvisoConfigurada(), ...opciones };
  const ahora = enZona();
  if (ahora.diaSemana === 0 || ahora.diaSemana === 6) return false;
  if (previo.horasAvisadas === ahora.fecha) return false;
  return (
    ahora.hora > cfg.horaAvisoHoras ||
    (ahora.hora === cfg.horaAvisoHoras && ahora.minuto >= cfg.minutoAvisoHoras)
  );
}

export function avisoDeHoras(horas: NonNullable<Snapshot["horas"]>, forzar = false): Aviso | null {
  if (horas.completo) {
    if (!forzar) return null;
    return {
      tipo: "horas",
      titulo: `Jornada completa: ${horas.horasHoy} h`,
      cuerpo: horas.detalle || `Ya registraste ${JORNADA} h hoy.`,
      url: horas.url
    };
  }

  return {
    tipo: "horas",
    titulo:
      horas.horasHoy === 0 ? "No has registrado horas hoy" : `Faltan ${horas.faltan} h por registrar hoy`,
    cuerpo:
      horas.horasHoy === 0
        ? `Jornada de ${JORNADA} h. Clic para abrir tus issues y usar /spend.`
        : `Llevas ${horas.horasHoy} h de ${JORNADA} h.\n${horas.detalle}`,
    url: horas.url
  };
}

/**
 * Compara la foto recien traida contra la de la vuelta anterior. Es una funcion
 * pura: no hace red, no toca disco. La primera vez siembra sin avisar de nada,
 * porque si no arrancaria disparando una notificacion por cada pendiente viejo.
 */
export function comparar(
  snapshot: Snapshot,
  previo: Estado,
  opciones: Partial<OpcionesAviso> = {}
): { avisos: Aviso[]; estado: Estado } {
  const avisos: Aviso[] = [];
  const estado: Estado = {
    sembrado: true,
    horasAvisadas: previo.horasAvisadas,
    versionAvisada: previo.versionAvisada,
    issuesAsignados: snapshot.issuesAsignados.map((i) => i.id),
    todos: snapshot.todos.map((t) => t.id),
    mrsReview: snapshot.mrsReview.map((m) => m.id),
    mrsMios: Object.fromEntries(
      snapshot.mrsMios.map((m) => [
        m.clave,
        { iid: m.iid, titulo: m.titulo, url: m.url, aprobadores: m.aprobadores }
      ])
    ),
    pipelines: Object.fromEntries(
      snapshot.pipelines.map((p) => [
        p.project,
        {
          id: p.id,
          status: p.status,
          despliegues: Object.fromEntries(p.despliegues.map((d) => [d.entorno, d.estado]))
        }
      ])
    )
  };

  if (!previo.sembrado) {
    if (snapshot.horas) estado.horasAvisadas = previo.horasAvisadas;
    return { avisos, estado };
  }

  for (const id of nuevos(estado.issuesAsignados, previo.issuesAsignados)) {
    const i = snapshot.issuesAsignados.find((x) => x.id === id)!;
    avisos.push({
      tipo: "issue",
      titulo: "Nuevo issue asignado",
      cuerpo: `#${i.iid} · ${i.titulo}`,
      url: i.url
    });
  }

  for (const id of nuevos(estado.todos, previo.todos)) {
    const t = snapshot.todos.find((x) => x.id === id)!;
    avisos.push({
      tipo: "todo",
      titulo: `GitLab: ${t.accion}`,
      cuerpo: `${t.titulo} · de ${t.autor}`,
      url: t.url
    });
  }

  for (const id of nuevos(estado.mrsReview, previo.mrsReview)) {
    const m = snapshot.mrsReview.find((x) => x.id === id)!;
    avisos.push({
      tipo: "mr-review",
      titulo: "MR esperando tu review",
      cuerpo: `!${m.iid} · ${m.titulo}`,
      url: m.url
    });
  }

  for (const m of snapshot.mrsMios) {
    const antes = previo.mrsMios[m.clave]?.aprobadores ?? [];
    if (!previo.mrsMios[m.clave]) continue; // MR recien abierto por ti: no es novedad
    for (const quien of nuevos(m.aprobadores, antes)) {
      avisos.push({
        tipo: "mr-aprobado",
        titulo: `${quien} aprobó tu MR`,
        cuerpo: `!${m.iid} · ${m.titulo}`,
        url: m.url
      });
    }
  }

  // Un MR propio que desaparecio de los abiertos: se asume cerrado o mergeado.
  for (const [clave, guardado] of Object.entries(previo.mrsMios)) {
    if (estado.mrsMios[clave]) continue;
    avisos.push({
      tipo: "mr-merged",
      titulo: "Tu MR ya no está abierto",
      cuerpo: `!${guardado.iid} · ${guardado.titulo}`,
      url: guardado.url
    });
  }

for (const p of snapshot.pipelines) {
    const antes = previo.pipelines[p.project];
    const repo = p.project.split("/").slice(-2).join("/");
    const cambio = !antes || antes.id !== p.id || antes.status !== p.status;

    if (p.status === "failed" && cambio) {
      avisos.push({
        tipo: "pipeline",
        titulo: "Pipeline roto",
        cuerpo:
          `${repo} · ${p.ref}` +
          (p.fallidos.length ? `
Falló: ${p.fallidos.join(", ")}` : ""),
        url: p.url
      });
    }

    // Despliegues: se sigue cada job de la etapa `deployment` por separado,
    // porque un pipeline puede desplegar a varios entornos y solo fallar uno.
    for (const d of p.despliegues) {
      const estadoAntes = antes?.despliegues?.[d.entorno];
      const mismoPipeline = antes?.id === p.id;
      // Sin estado previo del mismo pipeline no hay transición que anunciar:
      // evita avisar de despliegues viejos al arrancar o al cambiar de rama.
      if (!antes || (!mismoPipeline && !estadoAntes) || estadoAntes === d.estado) continue;

      if (d.estado === "success") {
        avisos.push({
          tipo: "despliegue",
          titulo: `Desplegado en ${d.entorno}`,
          cuerpo: `${repo} · ${p.ref}`,
          url: p.url
        });
      } else if (d.estado === "failed") {
        avisos.push({
          tipo: "despliegue",
          titulo: `Falló el despliegue a ${d.entorno}`,
          cuerpo: `${repo} · ${p.ref}`,
          url: p.url
        });
      }
      // running, canceled, manual y skipped no se notifican: son ruido.
    }
  }

  if (snapshot.horas && tocaAvisoDeHoras(previo, opciones)) {
    const aviso = avisoDeHoras(snapshot.horas);
    if (aviso) avisos.push(aviso);
    estado.horasAvisadas = fechaLocal();
  }

  return { avisos, estado };
}
