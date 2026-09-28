import assert from "node:assert/strict";
import { test } from "node:test";
import { GitLabError, type GitLabClient } from "../gitlab/client.js";
import { origenPermitido, validarToken } from "./token-login.js";

/** Crea clientes falsos que responden /user como se pida, y recuerda el token usado. */
function fabrica(respuesta: () => Promise<unknown>) {
  const tokens: string[] = [];
  const crear = (token: string) => {
    tokens.push(token);
    return { get: async () => ({ data: await respuesta(), headers: new Headers() }) } as unknown as GitLabClient;
  };
  return { crear, tokens };
}

const usuarioGitLab = {
  id: 44, username: "nhuamalies", name: "Nelson Huamalies",
  avatar_url: "https://gitlab.test/a.png", web_url: "https://gitlab.test/nhuamalies"
};

test("validarToken: un token válido devuelve el usuario y el token recortado", async () => {
  const { crear, tokens } = fabrica(async () => usuarioGitLab);
  const r = await validarToken("  glpat-abc123  ", crear);
  assert.equal(r.ok, true);
  assert.deepEqual(tokens, ["glpat-abc123"]);
  if (r.ok) {
    assert.equal(r.token, "glpat-abc123");
    assert.deepEqual(r.usuario, {
      id: 44, username: "nhuamalies", name: "Nelson Huamalies",
      avatar: "https://gitlab.test/a.png", url: "https://gitlab.test/nhuamalies"
    });
  }
});

test("validarToken: vacío no consulta GitLab", async () => {
  const { crear, tokens } = fabrica(async () => usuarioGitLab);
  const r = await validarToken("   ", crear);
  assert.deepEqual(r, { ok: false, error: "Pega tu token de acceso personal para continuar." });
  assert.equal(tokens.length, 0);
});

test("validarToken: 401 se explica como token inválido o vencido", async () => {
  const { crear } = fabrica(async () => {
    throw new GitLabError("Token invalido o expirado (401)", 401);
  });
  const r = await validarToken("glpat-malo", crear);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /inválido o venció/);
});

test("validarToken: 403 pide el scope read_api", async () => {
  const { crear } = fabrica(async () => {
    throw new GitLabError("sin permiso", 403);
  });
  const r = await validarToken("glpat-corto", crear);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /read_api/);
});

test("validarToken: sin red lo dice sin culpar al token", async () => {
  const { crear } = fabrica(async () => {
    throw new GitLabError("No se pudo conectar con GitLab: ECONNREFUSED", 0);
  });
  const r = await validarToken("glpat-x", crear);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /No se pudo conectar con GitLab/);
});

test("origenPermitido: solo la propia página puede iniciar sesión", () => {
  assert.equal(origenPermitido("https://dev-gitlab-mcp.vercel.app", "dev-gitlab-mcp.vercel.app"), true);
  assert.equal(origenPermitido("http://localhost:5179", "localhost:5179"), true);
  assert.equal(origenPermitido("https://malicioso.example", "dev-gitlab-mcp.vercel.app"), false);
  assert.equal(origenPermitido(undefined, "dev-gitlab-mcp.vercel.app"), false);
  assert.equal(origenPermitido("https://dev-gitlab-mcp.vercel.app", undefined), false);
});
