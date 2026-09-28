import { randomBytes } from "node:crypto";
import { GitLabClient } from "../gitlab/client.js";

/** Sesion inactiva mas de esto se descarta y obliga a volver a entrar. */
const TTL_MS = 8 * 60 * 60 * 1000;

export interface Usuario {
  id: number;
  username: string;
  name: string;
  avatar: string;
  url: string;
}

export interface Sesion {
  id: string;
  usuario: Usuario;
  /** El token vive solo aqui, en memoria del servidor. Nunca viaja al navegador. */
  accessToken: string;
  refreshToken?: string;
  client: GitLabClient;
  creada: number;
  ultimoUso: number;
}

export class SessionStore {
  private readonly sesiones = new Map<string, Sesion>();
  /** Estados OAuth pendientes: protegen el callback contra CSRF. */
  private readonly pendientes = new Map<string, number>();

  crearEstado(): string {
    this.limpiar();
    const estado = randomBytes(16).toString("hex");
    this.pendientes.set(estado, Date.now());
    return estado;
  }

  consumirEstado(estado: string): boolean {
    const creado = this.pendientes.get(estado);
    if (creado === undefined) return false;
    this.pendientes.delete(estado);
    // Diez minutos para completar el login; pasado eso, se rehace.
    return Date.now() - creado < 10 * 60 * 1000;
  }

  abrir(
    usuario: Usuario,
    accessToken: string,
    gitlabUrl: string,
    refreshToken?: string
  ): Sesion {
    const sesion: Sesion = {
      id: randomBytes(24).toString("hex"),
      usuario,
      accessToken,
      refreshToken,
      client: new GitLabClient(gitlabUrl, accessToken, "bearer"),
      creada: Date.now(),
      ultimoUso: Date.now()
    };
    this.sesiones.set(sesion.id, sesion);
    return sesion;
  }

  obtener(id: string | undefined): Sesion | null {
    if (!id) return null;
    const sesion = this.sesiones.get(id);
    if (!sesion) return null;
    if (Date.now() - sesion.ultimoUso > TTL_MS) {
      this.sesiones.delete(id);
      return null;
    }
    sesion.ultimoUso = Date.now();
    return sesion;
  }

  cerrar(id: string | undefined): Sesion | null {
    if (!id) return null;
    const sesion = this.sesiones.get(id) ?? null;
    this.sesiones.delete(id);
    return sesion;
  }

  private limpiar(): void {
    const ahora = Date.now();
    for (const [id, s] of this.sesiones) {
      if (ahora - s.ultimoUso > TTL_MS) this.sesiones.delete(id);
    }
    for (const [estado, creado] of this.pendientes) {
      if (ahora - creado > 10 * 60 * 1000) this.pendientes.delete(estado);
    }
  }

  get activas(): number {
    return this.sesiones.size;
  }
}
