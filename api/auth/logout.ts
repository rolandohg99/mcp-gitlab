import { cookieBorrada } from "../_lib/sesion.js";
import { guardia, type Req, type Res } from "../_lib/contexto.js";

/**
 * Cierra la sesión borrando la cookie. El token personal no se revoca: es de
 * la persona, puede usarlo en otros sitios, y lo revoca ella desde GitLab.
 */
export default guardia(async (_req: Req, res: Res) => {
  res.setHeader("Set-Cookie", cookieBorrada());
  res.status(302).setHeader("Location", "/login");
  res.end();
});
