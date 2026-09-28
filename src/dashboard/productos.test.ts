import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import type { GitLabClient } from "../gitlab/client.js";
import {
  contarActividad,
  detectarProductos,
  elegirProductos,
  invalidarCaches,
  productoDe
} from "./productos.js";

const RAIZ = "comsatel/development/products";

/**
 * Cliente falso: responde por ruta y cuenta las llamadas. Solo implementa lo
 * que usan catalogo() y detectarProductos().
 */
function clienteFalso(opciones: {
  issues?: Array<{ project_id: number }>;
  eventos?: Array<{ project_id: number }> | Error;
}) {
  const llamadas: string[] = [];
  const responder = async (ruta: string): Promise<unknown[]> => {
    llamadas.push(ruta);
    if (ruta.endsWith("/subgroups")) {
      return [
        { path: "sigo", name: "SIGO" },
        { path: "clocator2", name: "Clocator 2" }
      ];
    }
    if (ruta.endsWith("/projects")) {
      return [
        { id: 1, path_with_namespace: `${RAIZ}/sigo/microservices/bff`, jobs_enabled: true },
        { id: 2, path_with_namespace: `${RAIZ}/clocator2/api`, jobs_enabled: true },
        { id: 3, path_with_namespace: `${RAIZ}/collaboration`, jobs_enabled: true }
      ];
    }
    if (ruta === "/issues") return opciones.issues ?? [];
    if (ruta === "/merge_requests") return [];
    if (ruta === "/events") {
      if (opciones.eventos instanceof Error) throw opciones.eventos;
      return opciones.eventos ?? [];
    }
    throw new Error(`ruta no prevista: ${ruta}`);
  };
  const cliente = {
    getAll: (ruta: string) => responder(ruta),
    get: async (ruta: string) => ({ data: await responder(ruta), headers: new Headers() })
  };
  return { cliente: cliente as unknown as GitLabClient, llamadas };
}

const eventosEn = (id: number, n: number) => Array.from({ length: n }, () => ({ project_id: id }));

beforeEach(() => invalidarCaches());
afterEach(() => {
  delete process.env.DASHBOARD_PRODUCTS;
});

test("productoDe: primer segmento tras la raíz", () => {
  assert.equal(productoDe(`${RAIZ}/sigo/microservices/bff`), "sigo");
});

test("productoDe: un repo en la raíz no es de ningún producto", () => {
  assert.equal(productoDe(`${RAIZ}/collaboration`), null);
});

test("productoDe: fuera de la raíz no es de ningún producto", () => {
  assert.equal(productoDe("otro/grupo/repo"), null);
});

test("contarActividad ignora proyectos desconocidos y sin producto", () => {
  const mapa = new Map<number, string | null>([
    [1, "sigo"],
    [2, null]
  ]);
  assert.deepEqual(contarActividad(mapa, [1], [1, 1, 2, 99]), {
    sigo: { abiertos: 1, eventos: 2 }
  });
});

test("elegirProductos aplica el umbral y ordena por actividad", () => {
  assert.deepEqual(
    elegirProductos({
      sigo: { abiertos: 0, eventos: 152 },
      comunes: { abiertos: 1, eventos: 0 },
      "smart-suite": { abiertos: 0, eventos: 6 },
      clocator2: { abiertos: 0, eventos: 2 }
    }),
    ["sigo", "smart-suite", "comunes"]
  );
});

test("elegirProductos: sin actividad no hay productos", () => {
  assert.deepEqual(elegirProductos({}), []);
});

test("elegirProductos: 4 eventos no bastan, 5 sí", () => {
  assert.deepEqual(elegirProductos({ x: { abiertos: 0, eventos: 4 } }), []);
  assert.deepEqual(elegirProductos({ x: { abiertos: 0, eventos: 5 } }), ["x"]);
});

test("detectarProductos sigue con issues abiertos si /events falla", async () => {
  const { cliente } = clienteFalso({ issues: [{ project_id: 1 }], eventos: new Error("500") });
  assert.deepEqual(await detectarProductos(cliente, "ana"), [{ slug: "sigo", nombre: "SIGO" }]);
});

test("detectarProductos no cruza la caché entre usuarios", async () => {
  const ana = clienteFalso({ eventos: eventosEn(1, 10) });
  const luis = clienteFalso({ eventos: eventosEn(2, 10) });

  assert.deepEqual(await detectarProductos(ana.cliente, "ana"), [{ slug: "sigo", nombre: "SIGO" }]);
  assert.deepEqual(await detectarProductos(luis.cliente, "luis"), [
    { slug: "clocator2", nombre: "Clocator 2" }
  ]);

  const antes = ana.llamadas.filter((r) => r === "/events").length;
  await detectarProductos(ana.cliente, "ana");
  assert.equal(ana.llamadas.filter((r) => r === "/events").length, antes);
});

test("detectarProductos respeta DASHBOARD_PRODUCTS sin consultar eventos", async () => {
  process.env.DASHBOARD_PRODUCTS = " sigo , nuevo ";
  const { cliente, llamadas } = clienteFalso({ eventos: eventosEn(2, 10) });
  assert.deepEqual(await detectarProductos(cliente, "ana"), [
    { slug: "sigo", nombre: "SIGO" },
    { slug: "nuevo", nombre: "nuevo" }
  ]);
  assert.equal(llamadas.includes("/events"), false);
});
