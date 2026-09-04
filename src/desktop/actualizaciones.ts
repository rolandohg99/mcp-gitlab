import { encodeProject, type GitLabClient } from "../gitlab/client.js";

/** Dónde vive el manifiesto de versiones. Configurable por .env. */
export function origenActualizaciones(): { proyecto: string; ruta: string; ref: string } {
  return {
    proyecto:
      process.env.UPDATE_PROJECT?.trim() ||
      "comsatel/development/products/sigo/collaboration",
    ruta: process.env.UPDATE_PATH?.trim() || "panel-desarrollo/version.json",
    ref: process.env.UPDATE_REF?.trim() || "main"
  };
}

export interface InfoVersion {
  version: string;
  url: string;
  notas?: string;
  publicada?: string;
}

/**
 * El manifiesto lo escribe una persona en un repo: es dato no confiable. Se
 * valida forma y esquema de la URL antes de usarlo, y nunca se ejecuta nada
 * que venga de ahi.
 */
function validar(crudo: unknown): InfoVersion | null {
  if (!crudo || typeof crudo !== "object") return null;
  const o = crudo as Record<string, unknown>;

  const version = typeof o.version === "string" ? o.version.trim() : "";
  const url = typeof o.url === "string" ? o.url.trim() : "";
  if (!/^\d+\.\d+\.\d+/.test(version)) return null;

  // Solo http/https: evita que un manifiesto manipulado abra file:// u otros.
  if (!/^https?:\/\//i.test(url)) return null;

  return {
    version,
    url,
    notas: typeof o.notas === "string" ? o.notas.slice(0, 300) : undefined,
    publicada: typeof o.publicada === "string" ? o.publicada.slice(0, 40) : undefined
  };
}

/** Devuelve null si no hay manifiesto, no se puede leer, o está mal formado. */
export async function consultarUltimaVersion(client: GitLabClient): Promise<InfoVersion | null> {
  const { proyecto, ruta, ref } = origenActualizaciones();
  try {
    const { data } = await client.get<unknown>(
      `/projects/${encodeProject(proyecto)}/repository/files/${encodeURIComponent(ruta)}/raw`,
      { ref }
    );
    const json = typeof data === "string" ? JSON.parse(data) : data;
    return validar(json);
  } catch {
    // Sin manifiesto publicado todavia, o sin acceso: no es un error que valga
    // la pena mostrarle al usuario en cada vuelta.
    return null;
  }
}

function partes(v: string): number[] {
  return v
    .split("-")[0]!
    .split(".")
    .map((n) => Number.parseInt(n, 10) || 0);
}

/** Compara solo major.minor.patch; los sufijos (-beta) se ignoran. */
export function esMasNueva(remota: string, actual: string): boolean {
  const a = partes(remota);
  const b = partes(actual);
  for (let i = 0; i < 3; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}
