import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig, type Config } from "../config.js";
import { GitLabClient } from "../gitlab/client.js";
import { DashboardApi } from "./api.js";
import { CentroDeAvisos } from "./avisos.js";
import { buildTimelogReport } from "./timelogs.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(body));
}

export interface RunningServer {
  port: number;
  url: string;
  config: Config;
  client: GitLabClient;
  api: DashboardApi;
  me: { username: string; name: string; avatar: string; url: string };
  /** Historial que alimenta la campana del panel. */
  centro: CentroDeAvisos;
  close: () => Promise<void>;
}

/**
 * Levanta el dashboard y devuelve las piezas ya construidas, para que la app de
 * escritorio reutilice el mismo cliente y usuario en vez de duplicarlos.
 */
export interface OpcionesServidor {
  /** La invoca POST /api/logout. La app de escritorio borra la credencial. */
  alCerrarSesion?: () => void;
}

export async function startServer(
  port?: number,
  configuracion?: Config,
  opciones: OpcionesServidor = {}
): Promise<RunningServer> {
  // La app de escritorio pasa la configuracion del usuario logueado; el CLI la
  // toma del .env.
  const config = configuracion ?? loadConfig();
  const client = new GitLabClient(config.gitlabUrl, config.token);
  const api = new DashboardApi(client, config);

  // El usuario se resuelve una vez al arrancar: falla rapido si el token murio.
  const me = await api.me();
  const centro = new CentroDeAvisos();

  const chosen = port ?? Number(process.env.DASHBOARD_PORT ?? 5178);

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${chosen}`);

    switch (url.pathname) {
      case "/":
      case "/index.html": {
        const html = await readFile(resolve(ROOT, "public", "index.html"), "utf8");
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(html);
        return;
      }
      case "/app.css": {
        const css = await readFile(resolve(ROOT, "public", "app.css"), "utf8");
        res.writeHead(200, { "Content-Type": "text/css; charset=utf-8" });
        res.end(css);
        return;
      }
      case "/api/me":
        // `modo` le dice al front si mostrar el boton de cerrar sesion.
        json(res, 200, { ...me, modo: "token", puedeCerrarSesion: Boolean(opciones.alCerrarSesion) });
        return;
      case "/api/summary":
        json(res, 200, await api.summary(me.username));
        return;
      case "/api/pipelines":
        json(res, 200, await api.pipelines());
        return;
      case "/api/timelogs": {
        const dias = Number(url.searchParams.get("dias") ?? 14);
        json(res, 200, await buildTimelogReport(client, me.username, { dias }));
        return;
      }
      case "/api/logout": {
        if (!opciones.alCerrarSesion) {
          json(res, 400, { error: "Esta instancia no gestiona la sesión." });
          return;
        }
        json(res, 200, { ok: true });
        // Se responde primero: cerrar sesión apaga este mismo servidor.
        res.on("finish", () => setTimeout(() => opciones.alCerrarSesion?.(), 50));
        return;
      }
      case "/api/notificaciones":
        // El proceso de Electron ya las calculo y las empujo aqui.
        json(res, 200, centro.listar());
        return;
      case "/api/notificaciones/leidas": {
        const ids = (await leerCuerpo(req)) as { ids?: number[] };
        json(res, 200, { marcadas: centro.marcarLeidas(ids?.ids) });
        return;
      }
      default:
        json(res, 404, { error: "ruta no encontrada" });
    }
  }

  const server: Server = createServer((req, res) => {
    void handle(req, res).catch((error: Error) => json(res, 500, { error: error.message }));
  });

  // Solo loopback: el token vive en este proceso, no se expone a la red local.
  await new Promise<void>((ok, fail) => {
    server.once("error", fail);
    server.listen(chosen, "127.0.0.1", ok);
  });

  return {
    port: chosen,
    url: `http://127.0.0.1:${chosen}`,
    config,
    client,
    api,
    me,
    centro,
    close: () => new Promise<void>((ok) => server.close(() => ok()))
  };
}

async function leerCuerpo(req: IncomingMessage): Promise<unknown> {
  const trozos: Buffer[] = [];
  for await (const t of req) trozos.push(t as Buffer);
  const texto = Buffer.concat(trozos).toString("utf8");
  try {
    return texto ? JSON.parse(texto) : {};
  } catch {
    return {};
  }
}
