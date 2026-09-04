#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { GitLabClient } from "./gitlab/client.js";
import { registerIssueTools } from "./tools/issues.js";
import { registerProjectTools } from "./tools/projects.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const client = new GitLabClient(config.gitlabUrl, config.token);

  const server = new McpServer({
    name: "dev-gitlab-mcp",
    version: "0.1.0"
  });

  const context = { server, client, config };
  registerProjectTools(context);
  registerIssueTools(context);

  await server.connect(new StdioServerTransport());
}

main().catch((error: Error) => {
  // stderr: stdout esta reservado para el protocolo MCP.
  process.stderr.write(`[dev-gitlab-mcp] ${error.message}\n`);
  process.exit(1);
});
