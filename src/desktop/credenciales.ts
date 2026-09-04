import { app, safeStorage } from "electron";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/** Nombre del almacen del sistema, para explicarselo al usuario. */
export function nombreDelAlmacen(): string {
  if (process.platform === "darwin") return "el Llavero de macOS";
  if (process.platform === "win32") return "la protección de datos de Windows";
  return "el almacén de claves del sistema";
}

/**
 * El token se guarda cifrado con `safeStorage`, que usa el almacen del sistema:
 * DPAPI en Windows, Llavero en macOS, libsecret en Linux. Queda atado a la
 * cuenta del usuario: otra cuenta del mismo equipo no puede descifrarlo aunque
 * copie el archivo.
 */
function ruta(): string {
  return resolve(app.getPath("userData"), "credencial.bin");
}

export function hayCredencial(): boolean {
  return existsSync(ruta());
}

export function leerToken(): string | null {
  try {
    if (!existsSync(ruta())) return null;
    const cifrado = readFileSync(ruta());
    if (!safeStorage.isEncryptionAvailable()) return null;
    const token = safeStorage.decryptString(cifrado).trim();
    return token || null;
  } catch {
    // Credencial corrupta o cifrada por otra cuenta: se pide de nuevo.
    return null;
  }
}

export function guardarToken(token: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      "El cifrado del sistema no está disponible; no se guardará el token en claro."
    );
  }
  mkdirSync(app.getPath("userData"), { recursive: true });
  writeFileSync(ruta(), safeStorage.encryptString(token));
}

export function borrarCredencial(): void {
  try {
    rmSync(ruta(), { force: true });
  } catch {
    // Si no se puede borrar, la siguiente validacion fallara igual.
  }
}
