import assert from "node:assert/strict";
import { test } from "node:test";
import type { GitLabClient } from "../gitlab/client.js";
import { buildTimelogReport } from "./timelogs.js";
import { enZona } from "./zona.js";

/** Un registro de 1 h hoy, del usuario "yo", por página. */
function clienteFalso(opciones: { siguiente: boolean; esperaMs?: number }) {
  const grupos: string[] = [];
  const cliente = {
    graphql: async (_q: string, vars: { path: string }) => {
      grupos.push(vars.path);
      if (opciones.esperaMs) await new Promise((ok) => setTimeout(ok, opciones.esperaMs));
      return {
        group: {
          timelogs: {
            pageInfo: { hasNextPage: opciones.siguiente, endCursor: "x" },
            nodes: [
              {
                timeSpent: 3600,
                spentAt: `${enZona().fecha}T00:00:00Z`,
                summary: null,
                user: { username: "yo" },
                issue: { iid: 1, title: "t", webUrl: "" }
              }
            ]
          }
        }
      };
    }
  };
  return { cliente: cliente as unknown as GitLabClient, grupos };
}

test("horas: al agotar el presupuesto el informe queda parcial", async () => {
  const { cliente } = clienteFalso({ siguiente: true, esperaMs: 30 });
  const inicio = Date.now();
  const r = await buildTimelogReport(cliente, "yo", { dias: 3, grupos: ["g1"], presupuestoMs: 100 });
  assert.equal(r.parcial, true);
  assert.ok(Date.now() - inicio < 1000, "debe cortar cerca del presupuesto");
});

test("horas: suma los registros de todos los grupos", async () => {
  const { cliente, grupos } = clienteFalso({ siguiente: false });
  const r = await buildTimelogReport(cliente, "yo", { dias: 3, grupos: ["g1", "g2"] });
  assert.equal(r.parcial, false);
  assert.deepEqual(r.grupos, ["g1", "g2"]);
  assert.deepEqual(grupos, ["g1", "g2"]);
  assert.equal(r.horasHoy, 2);
});

test("horas: sin grupos no consulta y queda en cero", async () => {
  const { cliente, grupos } = clienteFalso({ siguiente: false });
  const r = await buildTimelogReport(cliente, "yo", { dias: 3, grupos: [] });
  assert.equal(r.totalHoras, 0);
  assert.equal(r.parcial, false);
  assert.equal(grupos.length, 0);
});

test("horas: el presupuesto incluye el tiempo de la detección", async () => {
  process.env.DASHBOARD_PRODUCTS = "sigo";
  delete process.env.TIMELOG_GROUP;
  const { cliente, grupos } = clienteFalso({ siguiente: false });
  (cliente as unknown as { getAll: () => Promise<unknown[]> }).getAll = () =>
    new Promise((ok) => setTimeout(() => ok([]), 150));
  try {
    const r = await buildTimelogReport(cliente, "yo", { dias: 3, presupuestoMs: 100 });
    assert.equal(r.parcial, true);
    assert.equal(grupos.length, 0);
  } finally {
    delete process.env.DASHBOARD_PRODUCTS;
  }
});
