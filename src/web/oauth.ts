import type { Usuario } from "./sessions.js";

export interface OAuthConfig {
  gitlabUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  /** Solo lectura: el panel muestra estadisticas, no escribe nada. */
  scope: string;
}

export function cargarOAuth(gitlabUrl: string, puerto: number): OAuthConfig {
  const clientId = process.env.OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.OAUTH_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    throw new Error(
      "Faltan OAUTH_CLIENT_ID y OAUTH_CLIENT_SECRET en .env.\n" +
        "Registra la aplicacion en GitLab: Preferences > Applications.\n" +
        `Redirect URI: ${process.env.OAUTH_REDIRECT_URI?.trim() || `http://localhost:${puerto}/auth/callback`}\n` +
        "Scopes: read_api (y openid, profile si quieres el nombre y avatar)."
    );
  }

  return {
    gitlabUrl,
    clientId,
    clientSecret,
    redirectUri:
      process.env.OAUTH_REDIRECT_URI?.trim() || `http://localhost:${puerto}/auth/callback`,
    scope: process.env.OAUTH_SCOPE?.trim() || "read_api"
  };
}

export function urlDeAutorizacion(cfg: OAuthConfig, estado: string): string {
  const url = new URL(`${cfg.gitlabUrl}/oauth/authorize`);
  url.searchParams.set("client_id", cfg.clientId);
  url.searchParams.set("redirect_uri", cfg.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", estado);
  url.searchParams.set("scope", cfg.scope);
  return url.toString();
}

export interface TokenRespuesta {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  scope: string;
}

export async function canjearCodigo(cfg: OAuthConfig, codigo: string): Promise<TokenRespuesta> {
  const cuerpo = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    code: codigo,
    grant_type: "authorization_code",
    redirect_uri: cfg.redirectUri
  });

  const respuesta = await fetch(`${cfg.gitlabUrl}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: cuerpo.toString()
  });

  const texto = await respuesta.text();
  if (!respuesta.ok) {
    throw new Error(`GitLab rechazo el canje del codigo (${respuesta.status}): ${texto.slice(0, 300)}`);
  }
  return JSON.parse(texto) as TokenRespuesta;
}

/** El token de OAuth va como Bearer, no como PRIVATE-TOKEN. */
export async function usuarioDelToken(cfg: OAuthConfig, accessToken: string): Promise<Usuario> {
  const respuesta = await fetch(`${cfg.gitlabUrl}/api/v4/user`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!respuesta.ok) {
    throw new Error(`No se pudo leer el usuario (${respuesta.status})`);
  }
  const u = (await respuesta.json()) as any;
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    avatar: u.avatar_url,
    url: u.web_url
  };
}

export async function revocar(cfg: OAuthConfig, token: string): Promise<void> {
  await fetch(`${cfg.gitlabUrl}/oauth/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      token
    }).toString()
  }).catch(() => {
    // Si la revocacion falla, la sesion local ya se borro igual.
  });
}
