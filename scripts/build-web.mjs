#!/usr/bin/env node
/**
 * Empaqueta el panel para el navegador: src/web/navegador.ts → public/panel.js.
 *
 * La web en Vercel no puede llegar a GitLab (la red de Comsatel lo bloquea desde
 * fuera); el navegador de cada persona sí, por la VPN. En el navegador no existe
 * process.env: se sustituye por un objeto con GITLAB_URL fijado al compilar y el
 * resto de variables caen a sus valores por defecto.
 *
 * Uso: node scripts/build-web.mjs   (GITLAB_URL opcional en el entorno)
 */
import { build } from "esbuild";

const gitlabUrl = process.env.GITLAB_URL || "https://project.comsatel.com.pe";

await build({
  entryPoints: [new URL("../src/web/navegador.ts", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")],
  outfile: new URL("../public/panel.js", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  minify: true,
  define: { "process.env": JSON.stringify({ GITLAB_URL: gitlabUrl }) },
  logLevel: "warning"
});

process.stdout.write(`public/panel.js listo (GitLab: ${gitlabUrl})\n`);
