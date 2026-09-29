import { GitLabError, type GitLabClient } from "../gitlab/client.js";
import type { Usuario } from "./sessions.js";

/**
 * Login web con token de acceso personal: cada persona entra con el suyo
 * (scope read_api), como en la app de escritorio. Lo comparten Vercel
 * (api/auth/token.ts) y el servidor web local.
 */

export type ResultadoToken =
  | { ok: true; usuario: Usuario; token: string }
  /** motivo "red": GitLab no respondió (sin VPN, caído); el resto, el token. */
  | { ok: false; error: string; motivo?: "red" };

/**
 * Comprueba el token contra GitLab. `crear` construye el cliente (inyectable
 * para las pruebas). Los mensajes dicen qué pasó y cómo seguir, sin repetir
 * el token.
 */
export async function validarToken(
  entrada: string,
  crear: (token: string) => GitLabClient
): Promise<ResultadoToken> {
  const token = String(entrada ?? "").trim();
  if (!token) return { ok: false, error: "Pega tu token de acceso personal para continuar." };

  try {
    const { data } = await crear(token).get<any>("/user");
    return {
      ok: true,
      token,
      usuario: {
        id: data.id,
        username: data.username,
        name: data.name,
        avatar: data.avatar_url,
        url: data.web_url
      }
    };
  } catch (error) {
    if (error instanceof GitLabError && error.status === 401) {
      return { ok: false, error: "El token es inválido o venció. Genera uno nuevo en GitLab con scope read_api." };
    }
    if (error instanceof GitLabError && error.status === 403) {
      return { ok: false, error: "El token no tiene permiso de lectura. Créalo con el scope read_api." };
    }
    if (error instanceof GitLabError && error.status === 0) {
      // Al registro del servidor, para diagnosticar (DNS, red, certificado); nunca el token.
      const causa = (error.details as { cause?: { code?: string; message?: string } } | undefined)?.cause;
      console.error(`[login] GitLab inalcanzable: ${error.message}${causa ? ` (${causa.code ?? ""} ${causa.message ?? ""})` : ""}`);
      return { ok: false, error: "No se pudo conectar con GitLab. Inténtalo de nuevo en un momento.", motivo: "red" };
    }
    return { ok: false, error: `GitLab no aceptó el token: ${(error as Error).message}` };
  }
}

/**
 * El login solo se acepta desde la propia página: sin esto, otra web podría
 * enviar el formulario e iniciar sesión en el navegador de alguien con una
 * cuenta ajena. Los navegadores mandan Origin en todo POST con fetch.
 */
export function origenPermitido(origin: string | undefined, host: string | undefined): boolean {
  if (!origin || !host) return false;
  return origin === `https://${host}` || origin === `http://${host}`;
}
