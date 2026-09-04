import { comparar, estadoInicial, type Aviso, type Estado } from "./comparador.js";
import type { Snapshot } from "./snapshot.js";

/** Tope de historial: lo viejo se descarta, nadie revisa 500 avisos. */
const MAXIMO = 100;

export interface AvisoRegistrado extends Aviso {
  id: number;
  fecha: string;
  leido: boolean;
}

/**
 * Historial de avisos de un usuario. Vive en memoria del servidor: es
 * conveniencia, no un registro que deba sobrevivir a un reinicio.
 *
 * Se alimenta de dos formas segun quien lo use:
 *  - `registrar`, cuando la app de escritorio ya calculo los avisos y solo
 *    quiere que la ventana los liste (evita consultar GitLab dos veces).
 *  - `sincronizar`, cuando el navegador es el unico cliente y hay que comparar
 *    contra la vuelta anterior aqui mismo.
 */
export class CentroDeAvisos {
  private readonly items: AvisoRegistrado[] = [];
  private estado: Estado = estadoInicial();
  private siguienteId = 1;

  registrar(avisos: Aviso[]): AvisoRegistrado[] {
    const nuevos = avisos.map((aviso) => ({
      ...aviso,
      id: this.siguienteId++,
      fecha: new Date().toISOString(),
      leido: false
    }));

    // Los mas recientes primero.
    this.items.unshift(...nuevos.reverse());
    if (this.items.length > MAXIMO) this.items.length = MAXIMO;
    return nuevos;
  }

  sincronizar(snapshot: Snapshot): AvisoRegistrado[] {
    const { avisos, estado } = comparar(snapshot, this.estado);
    this.estado = estado;
    return this.registrar(avisos);
  }

  /** Mantiene el estado alineado sin generar avisos (lo hizo otro cliente). */
  adoptarEstado(estado: Estado): void {
    this.estado = estado;
  }

  listar(): { items: AvisoRegistrado[]; noLeidas: number } {
    return {
      items: this.items,
      noLeidas: this.items.filter((i) => !i.leido).length
    };
  }

  marcarLeidas(ids?: number[]): number {
    const objetivo = ids?.length ? new Set(ids) : null;
    let cambiados = 0;
    for (const item of this.items) {
      if (item.leido) continue;
      if (objetivo && !objetivo.has(item.id)) continue;
      item.leido = true;
      cambiados++;
    }
    return cambiados;
  }

  limpiar(): void {
    this.items.length = 0;
  }
}
