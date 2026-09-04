import { randomBytes } from "node:crypto";
import { cookieEstado } from "../_lib/sesion.js";
import { gitlabUrl, guardia, origen, type Req, type Res } from "../_lib/contexto.js";

/** Arranca el flujo OAuth: guarda el estado en cookie y redirige a GitLab. */
export default guardia(async (req: Req, res: Res) => {
  const clientId = process.env.OAUTH_CLIENT_ID;
  if (!clientId) {
    res.status(500).json({ error: "Falta OAUTH_CLIENT_ID en las variables de entorno." });
    return;
  }

  const estado = randomBytes(16).toString("hex");
  const url = new URL(`${gitlabUrl()}/oauth/authorize`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", `${origen(req)}/api/auth/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", estado);
  url.searchParams.set("scope", process.env.OAUTH_SCOPE ?? "read_api");

  // El estado viaja en cookie: sin servidor donde recordarlo, es la unica
  // forma de comprobar en el callback que el login lo empezamos nosotros.
  res.setHeader("Set-Cookie", cookieEstado(estado));
  res.status(302).setHeader("Location", url.toString());
  res.end();
});
