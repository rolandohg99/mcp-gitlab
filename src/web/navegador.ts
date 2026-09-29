import { DashboardApi } from "../dashboard/api.js";
import { comparar, estadoInicial, type Estado } from "../dashboard/comparador.js";
import { construirSnapshot, pipelinesVigilados } from "../dashboard/snapshot.js";
import { buildTimelogReport } from "../dashboard/timelogs.js";
import { GitLabClient, GitLabError } from "../gitlab/client.js";
import { validarToken, type ResultadoToken } from "./token-login.js";

/**
 * El panel ejecutándose en el navegador (web en Vercel).
 *
 * La red de Comsatel bloquea GitLab desde fuera, así que un servidor en
 * internet no puede consultarlo. El navegador de cada persona sí, porque está
 * en la VPN: estas funciones hacen lo mismo que las rutas /api/* del servidor,
 * con la misma lógica y los mismos formatos, pero llamando a GitLab desde aquí.
 * Se empaqueta con esbuild en public/panel.js (scripts/build-web.mjs).
 */

export interface Almacen {
  getItem(clave: string): string | null;
  setItem(clave: string, valor: string): void;
  removeItem(clave: string): void;
}

export class ErrorPanel extends Error {
  constructor(
    readonly tipo: "sesion" | "red",
    mensaje: string
  ) {
    super(mensaje);
    this.name = "ErrorPanel";
  }
}

/** Solo la pestaña: sessionStorage se borra al cerrarla. */
const CLAVE_TOKEN = "panel-comsatel:token";
/** Historial de avisos de la web; se borra al cerrar sesión. */
const CLAVES_AVISOS = ["panel-sigo:avisos", "panel-sigo:estado"];

/**
 * Dentro de la VPN, GitLab resuelve a una IP privada (192.168.1.251): Chrome y
 * Edge piden permiso para que una web pública acceda a la red local, y sin él
 * bloquean la petición igual que si no hubiera VPN.
 */
export const MENSAJE_VPN =
  "No se alcanza GitLab. ¿Estás conectado a la VPN? Si el navegador pregunta si este sitio puede acceder a tu red local, permítelo.";

export function crearPanel(deps: {
  almacen: Almacen;
  crear: (token: string) => GitLabClient;
  gitlabUrl: string;
}) {
  const { almacen, crear, gitlabUrl } = deps;
  let usuario: { id: number; username: string; name: string; avatar: string; url: string } | null = null;

  const leerToken = (): string | null => {
    try {
      return almacen.getItem(CLAVE_TOKEN);
    } catch {
      return null;
    }
  };

  const olvidar = () => {
    usuario = null;
    try {
      almacen.removeItem(CLAVE_TOKEN);
    } catch {
      // Almacenamiento bloqueado: no había nada que borrar.
    }
  };

  /** Ejecuta con el cliente de la sesión y traduce los fallos de GitLab. */
  async function conCliente<T>(fn: (client: GitLabClient) => Promise<T>): Promise<T> {
    const token = leerToken();
    if (!token) throw new ErrorPanel("sesion", "Inicia sesión con tu token de acceso personal.");
    try {
      return await fn(crear(token));
    } catch (error) {
      if (error instanceof GitLabError && error.status === 401) {
        // Token revocado o vencido: se olvida para no reintentar con él.
        olvidar();
        throw new ErrorPanel("sesion", "Tu token ya no es válido. Vuelve a iniciar sesión.");
      }
      if (error instanceof GitLabError && error.status === 0) throw new ErrorPanel("red", MENSAJE_VPN);
      throw error;
    }
  }

  async function yo(client: GitLabClient) {
    if (usuario) return usuario;
    const { data } = await client.get<any>("/user");
    usuario = { id: data.id, username: data.username, name: data.name, avatar: data.avatar_url, url: data.web_url };
    return usuario;
  }

  return {
    async iniciarSesion(token: string): Promise<ResultadoToken> {
      const r = await validarToken(token, crear);
      if (!r.ok) return r.motivo === "red" ? { ok: false, error: MENSAJE_VPN } : r;
      try {
        almacen.setItem(CLAVE_TOKEN, r.token);
      } catch {
        return { ok: false, error: "Tu navegador no permite guardar la sesión en esta pestaña." };
      }
      usuario = r.usuario;
      return r;
    },

    cerrarSesion(): void {
      olvidar();
      for (const clave of CLAVES_AVISOS) {
        try {
          almacen.removeItem(clave);
        } catch {
          // Nada que borrar.
        }
      }
    },

    tieneToken: (): boolean => Boolean(leerToken()),

    me: () => conCliente(async (c) => ({ ...(await yo(c)), modo: "web", puedeCerrarSesion: true })),

    summary: () =>
      conCliente(async (c) => new DashboardApi(c, { gitlabUrl, token: "" }).summary((await yo(c)).username)),

    pipelines: () => conCliente(async (c) => pipelinesVigilados(c, (await yo(c)).username)),

    timelogs: (dias: number) => conCliente(async (c) => buildTimelogReport(c, (await yo(c)).username, { dias })),

    /** Igual que POST /api/notificaciones: el estado anterior lo guarda la página. */
    notificaciones: (previo: Estado | null) =>
      conCliente(async (c) => {
        const snapshot = await construirSnapshot(c, (await yo(c)).username, gitlabUrl, false);
        return comparar(snapshot, previo?.sembrado ? previo : estadoInicial());
      })
  };
}

// En el navegador (panel.js), el panel queda en window.PanelNavegador. En Node
// (pruebas, servidores) no hay window y esto no hace nada.
const g = globalThis as any;
if (typeof g.window !== "undefined" && g.sessionStorage) {
  const url = (process.env.GITLAB_URL || "https://project.comsatel.com.pe").replace(/\/+$/, "");
  g.window.PanelNavegador = crearPanel({
    almacen: g.sessionStorage,
    crear: (token) => new GitLabClient(url, token, "pat"),
    gitlabUrl: url
  });
  g.window.ErrorPanel = ErrorPanel;
}
