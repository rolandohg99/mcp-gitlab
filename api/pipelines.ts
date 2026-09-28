import { pipelinesVigilados } from "../src/dashboard/snapshot.js";
import { exigirSesion, guardia, type Req, type Res } from "./_lib/contexto.js";

export default guardia(async (req: Req, res: Res) => {
  const ctx = exigirSesion(req, res);
  if (!ctx) return;
  res.status(200).json(await pipelinesVigilados(ctx.client, ctx.sesion.usuario.username));
});
