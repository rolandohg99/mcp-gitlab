#!/usr/bin/env node
/**
 * Verifica el contraste WCAG 2.x de los tokens de color de public/app.css.
 *
 * PRODUCT.md exige AA: texto 4.5:1, controles e indicadores 3:1. Cambiar un
 * token sin pasar por aquí es la forma habitual de romperlo sin darse cuenta.
 *
 * Uso: node scripts/contraste.mjs   (sale con código 1 si algún par falla)
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Luminancia relativa de un "#rrggbb". */
function luminancia(hex) {
  const canal = (i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(1) + 0.7152 * canal(3) + 0.0722 * canal(5);
}

export function ratio(hexA, hexB) {
  const [a, b] = [luminancia(hexA), luminancia(hexB)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

/** Tokens `--nombre: #rrggbb` del primer bloque :root. Lo que no sea hex se ignora. */
export function leerTokens(css) {
  const bloque = /:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
  const tokens = {};
  for (const [, nombre, valor] of bloque.matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{6})\b/g)) {
    tokens[nombre] = valor.toLowerCase();
  }
  return tokens;
}

const FONDOS_TEXTO = ["--bg", "--sidebar", "--surface", "--surface-2", "--surface-3"];
const ACENTOS = ["--primary", "--success", "--warning", "--danger", "--accent-violeta"];

/** Pares que la interfaz usa de verdad. `#ffffff` es el texto sobre rellenos sólidos. */
export const PARES = [
  ...["--text", "--text-muted"].flatMap((texto) =>
    FONDOS_TEXTO.map((fondo) => ({ texto, fondo, minimo: 4.5 }))
  ),
  ...ACENTOS.flatMap((texto) =>
    ["--surface", "--surface-2"].map((fondo) => ({ texto, fondo, minimo: 4.5 }))
  ),
  { texto: "--primary-solid", fondo: "--surface", minimo: 3 },
  { texto: "--neutral-mark", fondo: "--surface-2", minimo: 3 },
  { texto: "#ffffff", fondo: "--primary-solid", minimo: 4.5 }
];

export function verificar(css) {
  const tokens = leerTokens(css);
  const valor = (n) => (n.startsWith("#") ? n : tokens[n]);
  const fallos = [];
  for (const { texto, fondo, minimo } of PARES) {
    const [a, b] = [valor(texto), valor(fondo)];
    if (!a || !b) {
      fallos.push(`${texto} sobre ${fondo}: token no definido`);
      continue;
    }
    const r = ratio(a, b);
    if (r < minimo) fallos.push(`${texto} sobre ${fondo}: ${r.toFixed(2)}:1 (mínimo ${minimo}:1)`);
  }
  return fallos;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const css = readFileSync(new URL("../public/app.css", import.meta.url), "utf8");
  const tokens = leerTokens(css);
  const valor = (n) => (n.startsWith("#") ? n : tokens[n]);
  for (const { texto, fondo, minimo } of PARES) {
    const [a, b] = [valor(texto), valor(fondo)];
    const r = a && b ? ratio(a, b) : 0;
    process.stdout.write(`${r >= minimo ? "ok " : "MAL"} ${r.toFixed(2).padStart(5)}:1  ${texto} sobre ${fondo}\n`);
  }
  const fallos = verificar(css);
  process.exit(fallos.length ? 1 : 0);
}
