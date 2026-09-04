import {
  cookieDeSesion,
  cookieEstadoBorrada,
  cifrar,
  leerCookie,
  nuevaSesion
} from "../_lib/sesion.js";
import { gitlabUrl, guardia, origen, param, type Req, type Res } from "../_lib/contexto.js";

function paginaError(mensaje: string): string {
  return `<!doctype html><meta charset="utf-8">
<title>Error de acceso</title>
<link rel="stylesheet" href="/app.css">
<body style="display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px">
  <main class="card" style="max-width:460px;padding:32px;text-align:center">
    <h1 style="font-size:1.25rem;margin-bottom:12px">No se pudo iniciar sesión</h1>
    <p class="text-muted" style="font-size:.8125rem">${mensaje}</p>
    <p style="margin-top:24px"><a class="btn btn-primary" href="/login">Reintentar</a></p>
  </main>
</body>`;
}

export default guardia(async (req: Req, res: Res) => {
  const error = param(req, "error");
  if (error) {
    res.status(400).setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(paginaError(`GitLab rechazó el acceso: ${error}`));
    return;
  }

  const codigo = param(req, "code");
  const estado = param(req, "state");
  const esperado = leerCookie(req.headers.cookie as string | undefined, "oauth_estado");

  // Sin coincidencia de estado no se sigue: es la proteccion contra CSRF.
  if (!codigo || !estado || !esperado || estado !== esperado) {
    res.status(400).setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(paginaError("Solicitud inválida o expirada. Vuelve a intentarlo."));
    return;
  }

  const cuerpo = new URLSearchParams({
    client_id: process.env.OAUTH_CLIENT_ID ?? "",
    client_secret: process.env.OAUTH_CLIENT_SECRET ?? "",
    code: codigo,
    grant_type: "authorization_code",
    redirect_uri: `${origen(req)}/api/auth/callback`
  });

  const respuesta = await fetch(`${gitlabUrl()}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: cuerpo.toString()
  });

  if (!respuesta.ok) {
    const detalle = (await respuesta.text()).slice(0, 200);
    res.status(400).setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(paginaError(`GitLab rechazó el canje del código (${respuesta.status}). ${detalle}`));
    return;
  }

  const token = (await respuesta.json()) as { access_token: string };

  const perfil = await fetch(`${gitlabUrl()}/api/v4/user`, {
    headers: { Authorization: `Bearer ${token.access_token}` }
  });
  if (!perfil.ok) {
    res.status(400).setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(paginaError(`No se pudo leer tu usuario (${perfil.status}).`));
    return;
  }

  const u = (await perfil.json()) as any;
  const sesion = nuevaSesion(
    { id: u.id, username: u.username, name: u.name, avatar: u.avatar_url, url: u.web_url },
    token.access_token
  );

  res.setHeader("Set-Cookie", [cookieDeSesion(cifrar(sesion)), cookieEstadoBorrada()]);
  res.status(302).setHeader("Location", "/");
  res.end();
});
