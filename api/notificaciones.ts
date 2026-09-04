import { comparar, estadoInicial, type Estado } from "../src/dashboard/comparador.js";
import { construirSnapshot } from "../src/dashboard/snapshot.js";
import { exigirSesion, gitlabUrl, guardia, type Req, type Res } from "./_lib/contexto.js";

/**
 * Diferencia sin estado en el servidor.
 *
 * El navegador manda el estado de la vuelta anterior (que guarda en
 * localStorage) y recibe los avisos nuevos junto al estado actualizado. Así la
 * lógica de comparación sigue viviendo en un solo sitio —`comparar()`, la misma
 * que usa la app de escritorio— pero el historial lo custodia el cliente, que
 * es lo único con memoria en un despliegue serverless.
 */
export default guardia(async (req: Req, res: Res) => {
  const ctx = exigirSesion(req, res);
  if (!ctx) return;

  if (req.method !== "POST") {
    res.status(405).json({ error: "Usa POST con el estado anterior en el cuerpo." });
    return;
  }

  const cuerpo = (req.body ?? {}) as { estado?: Estado; horas?: boolean };
  const previo: Estado = cuerpo.estado?.sembrado ? cuerpo.estado : estadoInicial();

  const snapshot = await construirSnapshot(
    ctx.client,
    ctx.sesion.usuario.username,
    gitlabUrl(),
    Boolean(cuerpo.horas)
  );

  const { avisos, estado } = comparar(snapshot, previo);
  res.status(200).json({ avisos, estado });
});
