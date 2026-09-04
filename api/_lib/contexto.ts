import { GitLabClient } from "../../src/gitlab/client.js";
import { descifrar, leerCookie, type Sesion } from "./sesion.js";

/** Petición y respuesta de Vercel, tipadas sin depender del paquete @vercel/node. */
export interface Req {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
  /** Vercel ya parsea el JSON del cuerpo cuando el content-type lo indica. */
  body?: unknown;
}

export interface Res {
  status(code: number): Res;
  setHeader(nombre: string, valor: string | string[]): void;
  json(cuerpo: unknown): void;
  send(cuerpo: string): void;
  end(): void;
}

export function gitlabUrl(): string {
  return (process.env.GITLAB_URL ?? "https://project.comsatel.com.pe").replace(/\/+$/, "");
}

export function origen(req: Req): string {
  const host = (req.headers["x-forwarded-host"] ?? req.headers.host) as string;
  const proto = (req.headers["x-forwarded-proto"] as string) ?? "https";
  return `${proto}://${host}`;
}

export function sesionDe(req: Req): Sesion | null {
  return descifrar(leerCookie(req.headers.cookie as string | undefined) ?? "") ?? null;
}

/**
 * Resuelve la sesión y construye el cliente. Devuelve null tras responder 401,
 * para que cada función se limite a: `const ctx = exigirSesion(req,res); if(!ctx) return;`
 */
export function exigirSesion(req: Req, res: Res): { sesion: Sesion; client: GitLabClient } | null {
  const sesion = sesionDe(req);
  if (!sesion) {
    res.status(401).json({ error: "sesión expirada", login: "/login" });
    return null;
  }
  // Token OAuth: va como Bearer, nunca como PRIVATE-TOKEN.
  return { sesion, client: new GitLabClient(gitlabUrl(), sesion.token, "bearer") };
}

/** Envuelve un handler para que un fallo no devuelva la traza de Vercel. */
export function guardia(
  handler: (req: Req, res: Res) => Promise<void>
): (req: Req, res: Res) => Promise<void> {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  };
}

export function param(req: Req, nombre: string): string | undefined {
  const v = req.query?.[nombre];
  return Array.isArray(v) ? v[0] : v;
}
