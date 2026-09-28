#!/usr/bin/env node
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadGitlabUrl } from "../config.js";
import { DashboardApi } from "../dashboard/api.js";
import { comparar, estadoInicial, type Estado } from "../dashboard/comparador.js";
import { construirSnapshot } from "../dashboard/snapshot.js";
import { buildTimelogReport } from "../dashboard/timelogs.js";
import { cargarOAuth, canjearCodigo, revocar, urlDeAutorizacion, usuarioDelToken } from "./oauth.js";
import { SessionStore, type Sesion } from "./sessions.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PORT = Number(process.env.WEB_PORT ?? 5179);
const COOKIE = "sid";

function fatal(mensaje: string): never {
  process.stderr.write(`\n[web] ${mensaje}\n\n`);
  process.exit(1);
}

// Configuracion incompleta: mensaje accionable, no un stack trace.
const { gitlabUrl, oauth } = (() => {
  try {
    const url = loadGitlabUrl();
    return { gitlabUrl: url, oauth: cargarOAuth(url, PORT) };
  } catch (error) {
    return fatal((error as Error).message);
  }
})();

const sesiones = new SessionStore();

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(body));
}

function redirigir(res: ServerResponse, destino: string, cookie?: string): void {
  const headers: Record<string, string | string[]> = { Location: destino };
  if (cookie) headers["Set-Cookie"] = cookie;
  res.writeHead(302, headers);
  res.end();
}

function leerCookie(req: IncomingMessage, nombre: string): string | undefined {
  const crudo = req.headers.cookie;
  if (!crudo) return undefined;
  for (const parte of crudo.split(";")) {
    const [k, ...v] = parte.trim().split("=");
    if (k === nombre) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

function cookieDeSesion(id: string): string {
  // Secure solo bajo https: en localhost el navegador descartaria la cookie.
  const seguro = oauth.redirectUri.startsWith("https://") ? "; Secure" : "";
  return `${COOKIE}=${id}; HttpOnly; Path=/; SameSite=Lax; Max-Age=28800${seguro}`;
}

function cookieBorrada(): string {
  return `${COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`;
}

async function servirArchivo(res: ServerResponse, nombre: string): Promise<void> {
  const html = await readFile(resolve(ROOT, "public", nombre), "utf8");
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

async function manejar(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const sesion = sesiones.obtener(leerCookie(req, COOKIE));

  switch (url.pathname) {
    case "/app.css": {
      const css = await readFile(resolve(ROOT, "public", "app.css"), "utf8");
      res.writeHead(200, { "Content-Type": "text/css; charset=utf-8" });
      res.end(css);
      return;
    }

    case "/login":
      if (sesion) return redirigir(res, "/");
      return servirArchivo(res, "login.html");

    case "/auth/login": {
      const estado = sesiones.crearEstado();
      return redirigir(res, urlDeAutorizacion(oauth, estado));
    }

    case "/auth/callback": {
      const error = url.searchParams.get("error");
      if (error) {
        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        res.end(`<p>GitLab rechazó el acceso: ${error}</p><p><a href="/login">Reintentar</a></p>`);
        return;
      }

      const codigo = url.searchParams.get("code");
      const estado = url.searchParams.get("state");
      if (!codigo || !estado || !sesiones.consumirEstado(estado)) {
        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        res.end("<p>Solicitud de login inválida o expirada.</p><p><a href='/login'>Reintentar</a></p>");
        return;
      }

      const token = await canjearCodigo(oauth, codigo);
      const usuario = await usuarioDelToken(oauth, token.access_token);
      const nueva = sesiones.abrir(usuario, token.access_token, gitlabUrl, token.refresh_token);
      process.stdout.write(`[login] ${usuario.username} (sesiones activas: ${sesiones.activas})\n`);
      return redirigir(res, "/", cookieDeSesion(nueva.id));
    }

    case "/auth/logout": {
      const cerrada = sesiones.cerrar(leerCookie(req, COOKIE));
      if (cerrada) await revocar(oauth, cerrada.accessToken);
      return redirigir(res, "/login", cookieBorrada());
    }

    case "/":
    case "/index.html":
      if (!sesion) return redirigir(res, "/login");
      return servirArchivo(res, "index.html");
  }

  // De aqui en adelante, todo exige sesion.
  if (!url.pathname.startsWith("/api/")) return json(res, 404, { error: "ruta no encontrada" });
  if (!sesion) return json(res, 401, { error: "sesión expirada", login: "/login" });

  return manejarApi(req, res, url, sesion);
}

async function manejarApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  sesion: Sesion
): Promise<void> {
  const api = new DashboardApi(sesion.client, { gitlabUrl, token: "" });

  switch (url.pathname) {
    case "/api/me":
      return json(res, 200, { ...sesion.usuario, modo: "oauth", puedeCerrarSesion: true });
    case "/api/summary":
      return json(res, 200, await api.summary(sesion.usuario.username));
    case "/api/pipelines":
      return json(res, 200, await api.pipelines());
    case "/api/timelogs": {
      const dias = Number(url.searchParams.get("dias") ?? 14);
      return json(
        res,
        200,
        await buildTimelogReport(sesion.client, sesion.usuario.username, { dias })
      );
    }
    case "/api/notificaciones": {
      // Mismo contrato que api/notificaciones.ts (Vercel): el front en modo
      // oauth custodia estado e historial en localStorage y espera
      // { avisos, estado }. El marcado de leidas tambien lo hace el navegador.
      if (req.method !== "POST") {
        return json(res, 405, { error: "Usa POST con el estado anterior en el cuerpo." });
      }
      const cuerpo = (await leerCuerpo(req)) as { estado?: Estado; horas?: boolean };
      const previo: Estado = cuerpo?.estado?.sembrado ? cuerpo.estado : estadoInicial();
      const snap = await construirSnapshot(
        sesion.client,
        sesion.usuario.username,
        gitlabUrl,
        Boolean(cuerpo?.horas)
      );
      return json(res, 200, comparar(snap, previo));
    }
    case "/api/poll": {
      // La app de escritorio pide horas solo cuando toca el recordatorio.
      const conHoras = url.searchParams.get("horas") === "1";
      return json(
        res,
        200,
        await construirSnapshot(sesion.client, sesion.usuario.username, gitlabUrl, conHoras)
      );
    }
    default:
      return json(res, 404, { error: "ruta no encontrada" });
  }
}

const servidor = createServer((req, res) => {
  void manejar(req, res).catch((error: Error) => {
    process.stderr.write(`[web] ${error.message}\n`);
    if (!res.headersSent) json(res, 500, { error: error.message });
  });
});

servidor.listen(PORT, () => {
  process.stdout.write(
    `Panel multiusuario en http://localhost:${PORT}\n` +
      `Instancia: ${gitlabUrl}\n` +
      `Redirect URI registrada: ${oauth.redirectUri}\n` +
      `Scope solicitado: ${oauth.scope}\n`
  );
});

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
