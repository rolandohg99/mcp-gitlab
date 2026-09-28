#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { GitLabClient } from "./gitlab/client.js";
import { registerIssueTools } from "./tools/issues.js";
import { registrarEscrituraK8s } from "./tools/k8s-escritura.js";
import { registrarLecturaK8s } from "./tools/k8s-lectura.js";
import { registerProjectTools } from "./tools/projects.js";

/**
 * La versión sale de package.json (dist/../package.json) para no tener que
 * acordarse de cambiarla en dos sitios. Si no se puede leer, no se impide
 * arrancar: el número es informativo.
 */
function versionDelPaquete(): string {
  try {
    const ruta = new URL("../package.json", import.meta.url);
    return (JSON.parse(readFileSync(ruta, "utf8")) as { version?: string }).version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

async function main(): Promise<void> {
  const config = loadConfig();
  const client = new GitLabClient(config.gitlabUrl, config.token);

  const server = new McpServer({
    name: "dev-gitlab-mcp",
    version: versionDelPaquete()
  });

  const context = { server, client, config };
  registerProjectTools(context);
  registerIssueTools(context);

  // Kubernetes: solo si hay bastión configurado. Sin K8S_SSH_HOST las
  // herramientas no se registran, en vez de aparecer y fallar al usarlas.
  if (process.env.K8S_SSH_HOST?.trim()) {
    registrarLecturaK8s(server);
    registrarEscrituraK8s(server);
  }

  await server.connect(new StdioServerTransport());
}

main().catch((error: Error) => {
  // stderr: stdout esta reservado para el protocolo MCP.
  process.stderr.write(`[dev-gitlab-mcp] ${error.message}\n`);
  process.exit(1);
});
