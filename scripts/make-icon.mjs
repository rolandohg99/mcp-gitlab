#!/usr/bin/env node
/**
 * Genera build/icon.png sin dependencias: un triangulo naranja tipo GitLab
 * sobre fondo transparente. Se ejecuta una vez; el PNG queda versionado.
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SIZE = Number(process.env.ICON_SIZE ?? 1024); // macOS exige 512+ para .icns
const NARANJA = [226, 67, 41];
const NARANJA_OSCURO = [252, 109, 38];

function crc32(buf) {
  let c;
  const tabla = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabla[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = tabla[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(tipo, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([len, cuerpo, crc]);
}

/** Triangulo isosceles apuntando hacia abajo, centrado. */
function dentroDelTriangulo(x, y) {
  const margen = SIZE * 0.12;
  const top = margen;
  const bottom = SIZE - margen;
  const alto = bottom - top;
  if (y < top || y > bottom) return false;
  const t = (y - top) / alto;
  const mitad = ((SIZE - margen * 2) / 2) * (1 - t);
  return Math.abs(x - SIZE / 2) <= mitad;
}

const pixeles = Buffer.alloc(SIZE * (SIZE * 4 + 1));
let off = 0;
for (let y = 0; y < SIZE; y++) {
  pixeles[off++] = 0; // filtro "none"
  for (let x = 0; x < SIZE; x++) {
    if (dentroDelTriangulo(x, y)) {
      // Degradado vertical simple para que no se vea plano.
      const t = y / SIZE;
      const c = NARANJA.map((v, i) => Math.round(v + (NARANJA_OSCURO[i] - v) * t));
      pixeles[off++] = c[0];
      pixeles[off++] = c[1];
      pixeles[off++] = c[2];
      pixeles[off++] = 255;
    } else {
      off += 4; // transparente
    }
  }
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bits por canal
ihdr[9] = 6; // RGBA
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(pixeles, { level: 9 })),
  chunk("IEND", Buffer.alloc(0))
]);

const destino = resolve(dirname(fileURLToPath(import.meta.url)), "..", "build", "icon.png");
mkdirSync(dirname(destino), { recursive: true });
writeFileSync(destino, png);
console.log(`icono escrito: ${destino} (${png.length} bytes, ${SIZE}x${SIZE})`);
