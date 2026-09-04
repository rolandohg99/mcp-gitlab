import { buildTimelogReport } from "../src/dashboard/timelogs.js";
import { exigirSesion, guardia, param, type Req, type Res } from "./_lib/contexto.js";

export default guardia(async (req: Req, res: Res) => {
  const ctx = exigirSesion(req, res);
  if (!ctx) return;
  const dias = Number(param(req, "dias") ?? 14);
  res.status(200).json(
    await buildTimelogReport(ctx.client, ctx.sesion.usuario.username, { dias })
  );
});
