import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// Lo genera `npm run build:web`, que `npm test` ejecuta antes.
const paquete = readFileSync(new URL("../public/panel.js", import.meta.url), "utf8");

test("panel.js expone PanelNavegador", () => {
  assert.match(paquete, /PanelNavegador/);
});

test("panel.js no arrastra módulos de Node (romperían en el navegador)", () => {
  assert.doesNotMatch(paquete, /["']node:/);
  assert.doesNotMatch(paquete, /\brequire\(/);
});
