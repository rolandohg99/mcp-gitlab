import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "../config.js";
import { GitLabClient, GitLabError } from "../gitlab/client.js";

export interface ToolContext {
  server: McpServer;
  client: GitLabClient;
  config: Config;
}

export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

export function text(value: unknown): ToolResult {
  return {
    content: [
      {
        type: "text",
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2)
      }
    ]
  };
}

export function failure(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

/**
 * Envuelve un handler para que los errores de GitLab lleguen al modelo como
 * texto accionable en vez de reventar la conexion MCP.
 */
export function guard<A>(
  handler: (args: A) => Promise<ToolResult>
): (args: A) => Promise<ToolResult> {
  return async (args: A) => {
    try {
      return await handler(args);
    } catch (error) {
      if (error instanceof GitLabError) return failure(error.message);
      return failure(`Error inesperado: ${(error as Error).message}`);
    }
  };
}

/** Resuelve el proyecto explicito o cae al GITLAB_DEFAULT_PROJECT del .env. */
export function resolveProject(config: Config, project?: string): string {
  const value = project?.trim() || config.defaultProject;
  if (!value) {
    throw new GitLabError(
      "No se indico proyecto y GITLAB_DEFAULT_PROJECT esta vacio en .env. " +
        "Pasa el path (grupo/proyecto) o el ID numerico.",
      400
    );
  }
  return value;
}
