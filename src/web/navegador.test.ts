import assert from "node:assert/strict";
import { test } from "node:test";
import { GitLabError, type GitLabClient } from "../gitlab/client.js";
import { crearPanel, type Almacen } from "./navegador.js";

const VPN = "No se alcanza GitLab. ¿Estás conectado a la VPN? Si el navegador pregunta si este sitio puede acceder a tu red local, permítelo.";

function almacen(opciones: { fallaEscritura?: boolean } = {}): Almacen & { datos: Map<string, string> } {
  const datos = new Map<string, string>();
  return {
    datos,
    getItem: (k) => datos.get(k) ?? null,
    setItem: (k, v) => {
      if (opciones.fallaEscritura) throw new Error("QuotaExceededError");
      datos.set(k, v);
    },
    removeItem: (k) => {
      datos.delete(k);
    }
  };
}

/** Cliente falso: `/user` responde según `usuario`; cualquier otra ruta, lista vacía. */
function cliente(usuario: () => Promise<unknown>) {
  return (_token: string) =>
    ({
      get: async (ruta: string) => ({ data: ruta === "/user" ? await usuario() : [], headers: new Headers() }),
      getAll: async () => [],
      graphql: async () => ({ group: { timelogs: { pageInfo: {}, nodes: [] } } })
    }) as unknown as GitLabClient;
}

const yo = async () => ({ id: 1, username: "ana", name: "Ana", avatar_url: "", web_url: "" });
const falla = (status: number) => async () => {
  throw new GitLabError("x", status);
};
const panel = (a: Almacen, c: (t: string) => GitLabClient) => crearPanel({ almacen: a, crear: c, gitlabUrl: "https://gitlab.test" });

test("iniciarSesion guarda el token recortado solo si es válido", async () => {
  const a = almacen();
  const p = panel(a, cliente(yo));
  assert.equal((await p.iniciarSesion("  glpat-x  ")).ok, true);
  assert.equal(a.datos.get("panel-comsatel:token"), "glpat-x");
  assert.equal(p.tieneToken(), true);

  const b = almacen();
  assert.equal((await panel(b, cliente(falla(401))).iniciarSesion("glpat-malo")).ok, false);
  assert.equal(b.datos.size, 0);
});

test("iniciarSesion avisa si el navegador no deja guardar la sesión", async () => {
  const r = await panel(almacen({ fallaEscritura: true }), cliente(yo)).iniciarSesion("glpat-x");
  assert.deepEqual(r, { ok: false, error: "Tu navegador no permite guardar la sesión en esta pestaña." });
});

test("iniciarSesion sin red pide revisar la VPN", async () => {
  const r = await panel(almacen(), cliente(falla(0))).iniciarSesion("glpat-x");
  assert.deepEqual(r, { ok: false, error: VPN });
});

test("sin token las consultas piden iniciar sesión", async () => {
  await assert.rejects(panel(almacen(), cliente(yo)).summary(), (e: any) => e.tipo === "sesion");
});

test("un 401 a mitad de uso borra el token y pide iniciar sesión", async () => {
  const a = almacen();
  a.datos.set("panel-comsatel:token", "glpat-viejo");
  const p = panel(a, cliente(falla(401)));
  await assert.rejects(p.me(), (e: any) => e.tipo === "sesion");
  assert.equal(p.tieneToken(), false);
});

test("sin red a mitad de uso, el error es de VPN", async () => {
  const a = almacen();
  a.datos.set("panel-comsatel:token", "glpat-x");
  await assert.rejects(panel(a, cliente(falla(0))).me(), (e: any) => e.tipo === "red" && e.message === VPN);
});

test("me devuelve el usuario en modo web", async () => {
  const a = almacen();
  a.datos.set("panel-comsatel:token", "glpat-x");
  const m = await panel(a, cliente(yo)).me();
  assert.equal(m.username, "ana");
  assert.equal(m.modo, "web");
  assert.equal(m.puedeCerrarSesion, true);
});

test("cerrarSesion borra el token y el historial de avisos", () => {
  const a = almacen();
  for (const k of ["panel-comsatel:token", "panel-sigo:avisos", "panel-sigo:estado", "otra"]) a.datos.set(k, "1");
  panel(a, cliente(yo)).cerrarSesion();
  assert.deepEqual([...a.datos.keys()], ["otra"]);
});
