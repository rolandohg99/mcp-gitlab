import { readFileSync } from "node:fs";
import { Client } from "ssh2";

/**
 * Ejecuta comandos en el bastión por SSH.
 *
 * En Windows el `ssh.exe` del sistema no acepta contraseña de forma
 * programática (la pide siempre por terminal interactiva), así que se usa el
 * protocolo directamente.
 */

export interface ConfigSsh {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
}

export interface Resultado {
  salida: string;
  error: string;
  codigo: number;
}

export class ErrorSsh extends Error {
  constructor(mensaje: string, readonly causa?: unknown) {
    super(mensaje);
    this.name = "ErrorSsh";
  }
}

export function cargarConfigSsh(): ConfigSsh {
  const host = process.env.K8S_SSH_HOST?.trim();
  const username = process.env.K8S_SSH_USER?.trim();
  const password = process.env.K8S_SSH_PASSWORD;
  const privateKey = process.env.K8S_SSH_KEY_PATH?.trim();

  if (!host || !username) {
    throw new ErrorSsh(
      "Faltan K8S_SSH_HOST y K8S_SSH_USER en .env. Copia .env.example y complétalos."
    );
  }
  if (!password && !privateKey) {
    throw new ErrorSsh(
      "Define K8S_SSH_PASSWORD o K8S_SSH_KEY_PATH en .env para autenticarte."
    );
  }

  return {
    host,
    port: Number(process.env.K8S_SSH_PORT ?? 22),
    username,
    password: password || undefined,
    privateKey: privateKey || undefined,
    passphrase: process.env.K8S_SSH_KEY_PASSPHRASE || undefined
  };
}

/**
 * Entrecomilla un argumento para bash. Todo lo que venga de fuera pasa por
 * aquí: sin esto, un nombre de pod con `;` ejecutaría otro comando en el
 * bastión.
 */
export function citar(arg: string): string {
  return `'${String(arg).replace(/'/g, `'\\''`)}'`;
}

/** Nombres de recursos de Kubernetes: solo el alfabeto que admite la propia API. */
export function validarNombre(valor: string, campo = "nombre"): string {
  const limpio = String(valor).trim();
  if (!/^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$/i.test(limpio)) {
    throw new ErrorSsh(
      `El ${campo} "${valor}" no es válido para Kubernetes (solo letras, números, punto y guion).`
    );
  }
  return limpio;
}

const TIEMPO_LIMITE_MS = Number(process.env.K8S_SSH_TIMEOUT_MS ?? 45_000);

/**
 * Abre una conexión, ejecuta y cierra. No se reutiliza la sesión a propósito:
 * el servidor MCP puede estar horas inactivo y una conexión SSH colgada da
 * errores mucho más confusos que reconectar.
 */
export function ejecutar(config: ConfigSsh, comando: string): Promise<Resultado> {
  return new Promise((resolver, rechazar) => {
    const conexion = new Client();
    let salida = "";
    let error = "";
    let terminado = false;

    const fin = (fn: () => void) => {
      if (terminado) return;
      terminado = true;
      try {
        conexion.end();
      } catch {
        // La conexión ya estaba cerrada.
      }
      fn();
    };

    const temporizador = setTimeout(() => {
      fin(() =>
        rechazar(new ErrorSsh(`El comando superó ${TIEMPO_LIMITE_MS / 1000}s sin responder.`))
      );
    }, TIEMPO_LIMITE_MS);

    conexion
      .on("ready", () => {
        conexion.exec(comando, (err, canal) => {
          if (err) {
            clearTimeout(temporizador);
            fin(() => rechazar(new ErrorSsh(`No se pudo ejecutar: ${err.message}`, err)));
            return;
          }
          canal
            .on("close", (codigo: number) => {
              clearTimeout(temporizador);
              fin(() => resolver({ salida, error, codigo: codigo ?? 0 }));
            })
            .on("data", (d: Buffer) => {
              salida += d.toString("utf8");
            })
            .stderr.on("data", (d: Buffer) => {
              error += d.toString("utf8");
            });
        });
      })
      .on("error", (err) => {
        clearTimeout(temporizador);
        fin(() => rechazar(new ErrorSsh(describirError(err), err)));
      })
      .connect({
        host: config.host,
        port: config.port,
        username: config.username,
        password: config.password,
        privateKey: config.privateKey ? leerClave(config.privateKey) : undefined,
        passphrase: config.passphrase,
        readyTimeout: TIEMPO_LIMITE_MS
      });
  });
}

function leerClave(ruta: string): Buffer {
  // Import estático: el paquete es ESM y `require` no existe en ese contexto.
  try {
    return readFileSync(ruta);
  } catch {
    throw new ErrorSsh(`No se pudo leer la clave privada en ${ruta}.`);
  }
}

function describirError(err: Error & { level?: string; code?: string }): string {
  if (err.level === "client-authentication") {
    return "Autenticación rechazada: revisa K8S_SSH_USER y la contraseña o clave.";
  }
  if (err.code === "ECONNREFUSED") {
    return "Conexión rechazada: ¿es correcto el host y el puerto? ¿está abierto el SSH?";
  }
  if (err.code === "ETIMEDOUT" || err.code === "EHOSTUNREACH") {
    return "No se alcanza el host. ¿Estás en la red o VPN correcta?";
  }
  return `Error de SSH: ${err.message}`;
}
