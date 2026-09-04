import { DashboardApi } from "../src/dashboard/api.js";
import { exigirSesion, gitlabUrl, guardia, type Req, type Res } from "./_lib/contexto.js";

export default guardia(async (req: Req, res: Res) => {
  const ctx = exigirSesion(req, res);
  if (!ctx) return;
  const api = new DashboardApi(ctx.client, { gitlabUrl: gitlabUrl(), token: "" });
  res.status(200).json(await api.summary(ctx.sesion.usuario.username));
});
