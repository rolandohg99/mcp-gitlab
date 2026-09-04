import { construirSnapshot } from "../src/dashboard/snapshot.js";
import { exigirSesion, gitlabUrl, guardia, param, type Req, type Res } from "./_lib/contexto.js";

/**
 * Foto del estado del usuario. El navegador la compara contra la anterior que
 * guarda en localStorage: sin servidor con memoria, el historial de avisos vive
 * en el cliente, igual que hace la app de escritorio.
 */
export default guardia(async (req: Req, res: Res) => {
  const ctx = exigirSesion(req, res);
  if (!ctx) return;
  const conHoras = param(req, "horas") === "1";
  res.status(200).json(
    await construirSnapshot(ctx.client, ctx.sesion.usuario.username, gitlabUrl(), conHoras)
  );
});
