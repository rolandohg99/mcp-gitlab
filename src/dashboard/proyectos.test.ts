import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import type { GitLabClient } from "../gitlab/client.js";
import { invalidarCaches } from "./productos.js";
import { proyectosVigilados, separarRuta } from "./proyectos.js";

const RAIZ = "comsatel/development/products";

function clienteFalso() {
  const llamadas: string[] = [];
  const cliente = {
    getAll: async (ruta: string) => {
      llamadas.push(ruta);
      if (ruta.endsWith("/subgroups")) return [{ path: "sigo", name: "SIGO" }];
      if (ruta.endsWith("/projects")) {
        return [
          { id: 1, path_with_namespace: `${RAIZ}/sigo/microservices/bff`, jobs_enabled: true },
          { id: 2, path_with_namespace: `${RAIZ}/sigo/issues`, jobs_enabled: false },
          { id: 3, path_with_namespace: `${RAIZ}/clocator2/api`, jobs_enabled: true },
          { id: 4, path_with_namespace: `${RAIZ}/collaboration`, jobs_enabled: true }
        ];
      }
      throw new Error(`ruta no prevista: ${ruta}`);
    }
  };
  return { cliente: cliente as unknown as GitLabClient, llamadas };
}

beforeEach(() => invalidarCaches());

test("separarRuta: producto y carpeta anidada", () => {
  assert.deepEqual(separarRuta(`${RAIZ}/sigo/servicios-soa/tareas/api`), {
    producto: "sigo",
    grupo: "servicios-soa/tareas",
    nombre: "api"
  });
});

test("separarRuta: repo en la raíz del producto", () => {
  assert.deepEqual(separarRuta(`${RAIZ}/comunes/libs`), {
    producto: "comunes",
    grupo: "(sin carpeta)",
    nombre: "libs"
  });
});

test("proyectosVigilados sin productos no consulta GitLab", async () => {
  const { cliente, llamadas } = clienteFalso();
  assert.deepEqual(await proyectosVigilados(cliente, "ana", []), []);
  assert.equal(llamadas.length, 0);
});

test("proyectosVigilados: solo repos con CI de los productos pedidos", async () => {
  const { cliente } = clienteFalso();
  const repos = await proyectosVigilados(cliente, "ana", ["sigo"]);
  assert.deepEqual(
    repos.map((r) => r.path),
    [`${RAIZ}/sigo/microservices/bff`]
  );
});
