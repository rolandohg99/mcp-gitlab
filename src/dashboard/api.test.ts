import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { GitLabError, type GitLabClient } from "../gitlab/client.js";
import { DashboardApi } from "./api.js";
import { invalidarCaches } from "./productos.js";

const RAIZ = "comsatel/development/products";

/** Cliente falso para summary(): rutas decodificadas, errores a pedido. */
function clienteFalso(opciones: { catalogoRoto?: boolean; productoRoto?: string }) {
  const responder = async (rutaCodificada: string) => {
    const ruta = decodeURIComponent(rutaCodificada);
    if (ruta.endsWith("/subgroups")) {
      if (opciones.catalogoRoto) throw new GitLabError("GitLab respondio 500", 500);
      return [{ path: "sigo", name: "SIGO" }];
    }
    if (ruta.endsWith(`${RAIZ}/projects`)) {
      if (opciones.catalogoRoto) throw new GitLabError("GitLab respondio 500", 500);
      return [];
    }
    if (opciones.productoRoto && ruta.includes(`/${opciones.productoRoto}/`)) {
      throw new GitLabError("Recurso no encontrado (404)", 404);
    }
    return [];
  };
  const cliente = {
    getAll: (ruta: string) => responder(ruta),
    get: async (ruta: string) => ({
      data: await responder(ruta),
      headers: new Headers({ "x-total": "3" })
    })
  };
  return cliente as unknown as GitLabClient;
}

const api = (c: GitLabClient) => new DashboardApi(c, { gitlabUrl: "https://gitlab.test", token: "" });

beforeEach(() => invalidarCaches());
afterEach(() => {
  delete process.env.DASHBOARD_PRODUCTS;
});

test("summary: un producto roto no borra los bugs de los demás", async () => {
  process.env.DASHBOARD_PRODUCTS = "sigo,clocatr2";
  const s = await api(clienteFalso({ productoRoto: "clocatr2" })).summary("ana");

  const sigo = s.bugs.filter((b) => b.producto === "sigo");
  assert.equal(sigo.length, 9);
  assert.ok(sigo.every((b) => b.total === 3));
  assert.ok(s.errors.some((e) => e.includes("clocatr2")), JSON.stringify(s.errors));
});

test("summary: si falla la detección, lo dice en errors y sigue", async () => {
  const s = await api(clienteFalso({ catalogoRoto: true })).summary("ana");
  assert.deepEqual(s.productos, []);
  assert.ok(s.errors.some((e) => e.startsWith("productos")), JSON.stringify(s.errors));
});

test("summary: cuenta los 9 estados del flujo de bugs y solo issues abiertos", async () => {
  process.env.DASHBOARD_PRODUCTS = "sigo";
  const consultas: Array<Record<string, unknown>> = [];
  const cliente = clienteFalso({});
  const espia = cliente as unknown as { get: (r: string, q?: Record<string, unknown>) => Promise<unknown> };
  const original = espia.get;
  espia.get = (ruta, q) => {
    if (decodeURIComponent(ruta).endsWith("/issues") && q?.labels) consultas.push(q);
    return original(ruta, q);
  };

  const s = await api(cliente).summary("ana");
  assert.deepEqual(
    s.bugs.map((b) => b.estado),
    ["New", "To Analysis", "In Analysis", "To Develop", "In Development", "To Test", "In Test", "Done", "Deployed"]
  );
  assert.equal(consultas.filter((q) => q.state === "opened").length, 9);
});

test("summary: cada estado trae también sus cerrados", async () => {
  process.env.DASHBOARD_PRODUCTS = "sigo";
  const cliente = clienteFalso({});
  const espia = cliente as unknown as { get: (r: string, q?: Record<string, unknown>) => Promise<unknown> };
  const original = espia.get;
  const estados: string[] = [];
  espia.get = async (ruta, q) => {
    const r = (await original(ruta, q)) as { data: unknown; headers: Headers };
    if (q?.labels) estados.push(String(q.state));
    // Abiertos 3 (del falso); cerrados 7.
    return q?.state === "closed" ? { ...r, headers: new Headers({ "x-total": "7" }) } : r;
  };

  const s = await api(cliente).summary("ana");
  assert.equal(estados.filter((e) => e === "closed").length, 9);
  assert.ok(s.bugs.every((b) => b.total === 3 && b.cerrados === 7));
  assert.ok(s.bugs.every((b) => b.urlCerrados.includes("state=closed")));
});
