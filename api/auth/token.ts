import { GitLabClient } from "../../src/gitlab/client.js";
import { origenPermitido, validarToken } from "../../src/web/token-login.js";
import { cifrar, cookieDeSesion, nuevaSesion } from "../_lib/sesion.js";
import { gitlabUrl, guardia, type Req, type Res } from "../_lib/contexto.js";

/**
 * Login con token de acceso personal. Cada persona entra con el suyo (scope
 * read_api): se valida contra GitLab y viaja cifrado dentro de la cookie de
 * sesión, que es el único sitio donde queda.
 */
export default guardia(async (req: Req, res: Res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Usa POST con el token en el cuerpo." });
    return;
  }

  const host = (req.headers["x-forwarded-host"] ?? req.headers.host) as string | undefined;
  if (!origenPermitido(req.headers.origin as string | undefined, host)) {
    res.status(403).json({ error: "Solicitud no permitida: el login solo se acepta desde la propia página." });
    return;
  }

  const cuerpo = (req.body ?? {}) as { token?: string };
  const r = await validarToken(String(cuerpo.token ?? ""), (t) => new GitLabClient(gitlabUrl(), t, "pat"));
  if (!r.ok) {
    res.status(400).json({ error: r.error });
    return;
  }

  res.setHeader("Set-Cookie", cookieDeSesion(cifrar(nuevaSesion(r.usuario, r.token))));
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ ok: true, username: r.usuario.username });
});
