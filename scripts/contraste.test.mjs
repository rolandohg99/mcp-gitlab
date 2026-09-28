import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { leerTokens, ratio, verificar } from "./contraste.mjs";

const css = readFileSync(new URL("../public/app.css", import.meta.url), "utf8");

test("ratio: negro sobre blanco es 21:1", () => {
  assert.ok(Math.abs(ratio("#000000", "#ffffff") - 21) < 0.01);
});

test("ratio: un color contra sí mismo es 1:1", () => {
  assert.equal(ratio("#ffffff", "#ffffff"), 1);
});

test("leerTokens: solo toma valores hex del :root", () => {
  assert.deepEqual(leerTokens(":root { --bg: #0b1220; --x: rgba(0,0,0,1); }"), { "--bg": "#0b1220" });
});

test("app.css usa la paleta azul marino", () => {
  assert.equal(leerTokens(css)["--bg"], "#0b1220");
});

test("app.css cumple AA en todos los pares definidos", () => {
  assert.deepEqual(verificar(css), []);
});
