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
  assert.equal(sigo.length, 6);
  assert.ok(sigo.every((b) => b.total === 3));
  assert.ok(s.errors.some((e) => e.includes("clocatr2")), JSON.stringify(s.errors));
});

test("summary: si falla la detección, lo dice en errors y sigue", async () => {
  const s = await api(clienteFalso({ catalogoRoto: true })).summary("ana");
  assert.deepEqual(s.productos, []);
  assert.ok(s.errors.some((e) => e.startsWith("productos")), JSON.stringify(s.errors));
});
