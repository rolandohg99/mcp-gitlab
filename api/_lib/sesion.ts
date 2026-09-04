import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Sesión sin servidor de estado.
 *
 * En Vercel cada petición puede caer en una instancia distinta y efímera, así
 * que un Map en memoria no sirve. El token de GitLab viaja cifrado dentro de la
 * propia cookie (AES-256-GCM): el navegador solo ve bytes opacos y sin la clave
 * del servidor no puede leerlos ni alterarlos —GCM detecta cualquier cambio—.
 */

const COOKIE = "sesion";
const TTL_S = 8 * 60 * 60;

export interface Sesion {
  usuario: { id: number; username: string; name: string; avatar: string; url: string };
  token: string;
  /** Epoch en segundos. Se valida al descifrar, no solo en la cookie. */
  exp: number;
}

function clave(): Buffer {
  const secreto = process.env.SESSION_SECRET;
  if (!secreto || secreto.length < 32) {
    throw new Error(
      "Falta SESSION_SECRET (mínimo 32 caracteres). Genera uno con: openssl rand -base64 32"
    );
  }
  // scrypt sería mejor, pero se ejecuta en cada petición: sha256 sobre un
  // secreto ya aleatorio de 32+ bytes es suficiente para derivar la clave.
  return createHash("sha256").update(secreto).digest();
}

export function cifrar(sesion: Sesion): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", clave(), iv);
  const datos = Buffer.concat([
    cipher.update(JSON.stringify(sesion), "utf8"),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, datos]).toString("base64url");
}

export function descifrar(valor: string): Sesion | null {
  try {
    const bruto = Buffer.from(valor, "base64url");
    if (bruto.length < 29) return null;

    const iv = bruto.subarray(0, 12);
    const tag = bruto.subarray(12, 28);
    const datos = bruto.subarray(28);

    const decipher = createDecipheriv("aes-256-gcm", clave(), iv);
    decipher.setAuthTag(tag);
    const texto = Buffer.concat([decipher.update(datos), decipher.final()]).toString("utf8");

    const sesion = JSON.parse(texto) as Sesion;
    if (!sesion?.token || !sesion?.usuario) return null;
    if (sesion.exp && sesion.exp < Math.floor(Date.now() / 1000)) return null;
    return sesion;
  } catch {
    // Firma inválida, clave rotada o cookie manipulada: se trata como "sin sesión".
    return null;
  }
}

export function nuevaSesion(usuario: Sesion["usuario"], token: string): Sesion {
  return { usuario, token, exp: Math.floor(Date.now() / 1000) + TTL_S };
}

export function leerCookie(cabecera: string | undefined, nombre = COOKIE): string | undefined {
  if (!cabecera) return undefined;
  for (const parte of cabecera.split(";")) {
    const [k, ...v] = parte.trim().split("=");
    if (k === nombre) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

/** En Vercel todo es https, así que la cookie siempre va marcada Secure. */
export function cookieDeSesion(valor: string): string {
  return `${COOKIE}=${valor}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${TTL_S}`;
}

export function cookieBorrada(): string {
  return `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

/** Estado OAuth: cookie corta y separada, solo para el ida y vuelta del login. */
export function cookieEstado(estado: string): string {
  return `oauth_estado=${estado}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`;
}

export function cookieEstadoBorrada(): string {
  return `oauth_estado=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}
