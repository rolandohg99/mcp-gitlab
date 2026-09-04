#!/usr/bin/env node
import { startServer } from "./server.js";

startServer()
  .then((s) => {
    process.stdout.write(
      `Dashboard de ${s.me.username} en http://localhost:${s.port}\n` +
        `Instancia: ${s.config.gitlabUrl}\n`
    );
  })
  .catch((error: Error) => {
    process.stderr.write(`[dashboard] ${error.message}\n`);
    process.exit(1);
  });
