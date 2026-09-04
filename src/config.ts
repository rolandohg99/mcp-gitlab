import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Carga .env buscando primero junto al proyecto (dist/../.env) y luego en el cwd.
 * El servidor MCP se arranca desde rutas arbitrarias, por eso no basta con cwd.
 */
function loadEnv(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(here, "..", ".env"),
    resolve(process.cwd(), ".env"),
    // App empaquetada: el .env viaja junto al .exe, nunca dentro del asar.
    ...(process.resourcesPath ? [resolve(process.resourcesPath, ".env")] : [])
  ];
  for (const file of candidates) {
    if (existsSync(file) && typeof process.loadEnvFile === "function") {
      process.loadEnvFile(file);
      return;
    }
  }
}

loadEnv();

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Falta la variable ${name}. Copia .env.example a .env y completala.`
    );
  }
  return value;
}

export interface Config {
  gitlabUrl: string;
  token: string;
  defaultProject?: string;
}

/**
 * Solo la URL de la instancia. La app web multiusuario no necesita un token de
 * servicio: cada sesion trae el suyo por OAuth.
 */
export function loadGitlabUrl(): string {
  return required("GITLAB_URL").replace(/\/+$/, "");
}

export function loadConfig(): Config {
  const url = required("GITLAB_URL").replace(/\/+$/, "");
  const token = required("GITLAB_TOKEN");

  if (token.startsWith("glpat-xxx")) {
    throw new Error(
      "GITLAB_TOKEN sigue con el valor de ejemplo. Genera un token real con scope `api`."
    );
  }

  const defaultProject = process.env.GITLAB_DEFAULT_PROJECT?.trim() || undefined;
  return { gitlabUrl: url, token, defaultProject };
}
