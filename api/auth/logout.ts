import { cookieBorrada } from "../_lib/sesion.js";
import { gitlabUrl, guardia, sesionDe, type Req, type Res } from "../_lib/contexto.js";

/** Borra la cookie y revoca el token en GitLab, no solo localmente. */
export default guardia(async (req: Req, res: Res) => {
  const sesion = sesionDe(req);

  if (sesion) {
    await fetch(`${gitlabUrl()}/oauth/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.OAUTH_CLIENT_ID ?? "",
        client_secret: process.env.OAUTH_CLIENT_SECRET ?? "",
        token: sesion.token
      }).toString()
    }).catch(() => {
      // Si la revocacion falla, la cookie se borra igual: la sesion muere aqui.
    });
  }

  res.setHeader("Set-Cookie", cookieBorrada());
  res.status(302).setHeader("Location", "/login");
  res.end();
});
