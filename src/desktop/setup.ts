import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { GitLabClient } from "../gitlab/client.js";
import { guardarToken, nombreDelAlmacen } from "./credenciales.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export interface SetupResultado {
  usuario: { username: string; name: string };
  token: string;
}

/**
 * Servidor minimo que atiende solo la pantalla de token. Se usa una vez, antes
 * de que exista credencial: sirve el formulario, valida contra GitLab y se
 * apaga. Evita tener que montar IPC con preload solo para pedir un dato.
 */
export function servirSetup(
  puerto: number,
  gitlabUrl: string
): { url: string; listo: Promise<SetupResultado>; cerrar: () => Promise<void> } {
  let resolver!: (r: SetupResultado) => void;
  const listo = new Promise<SetupResultado>((ok) => {
    resolver = ok;
  });

  const servidor: Server = createServer((req, res) => {
    void (async () => {
      if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
        const html = (await readFile(resolve(ROOT, "public", "token.html"), "utf8")).replace("{{GITLAB_URL}}", gitlabUrl).replace("{{ALMACEN}}", nombreDelAlmacen());
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(html);
        return;
      }

      if (req.method === "GET" && req.url === "/app.css") {
        const css = await readFile(resolve(ROOT, "public", "app.css"), "utf8");
        res.writeHead(200, { "Content-Type": "text/css; charset=utf-8" });
        res.end(css);
        return;
      }

      if (req.method === "POST" && req.url === "/guardar") {
        const cuerpo = await leerCuerpo(req);
        const token = String((cuerpo as any).token ?? "").trim();

        if (!token) {
          return json(res, 400, { error: "Pega tu token para continuar." });
        }

        try {
          const client = new GitLabClient(gitlabUrl, token);
          const { data } = await client.get<any>("/user");
          guardarToken(token);
          json(res, 200, { ok: true, username: data.username, name: data.name });
          resolver({ usuario: { username: data.username, name: data.name }, token });
        } catch (error) {
          json(res, 400, { error: (error as Error).message });
        }
        return;
      }

      json(res, 404, { error: "no encontrado" });
    })().catch((error: Error) => json(res, 500, { error: error.message }));
  });

  servidor.listen(puerto, "127.0.0.1");

  return {
    url: `http://127.0.0.1:${puerto}`,
    listo,
    cerrar: () => new Promise<void>((ok) => servidor.close(() => ok()))
  };
}

function json(res: any, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function leerCuerpo(req: any): Promise<unknown> {
  const trozos: Buffer[] = [];
  for await (const t of req) trozos.push(t as Buffer);
  const texto = Buffer.concat(trozos).toString("utf8");
  try {
    return texto ? JSON.parse(texto) : {};
  } catch {
    return {};
  }
}
