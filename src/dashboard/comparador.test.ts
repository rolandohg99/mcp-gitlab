import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { comparar, estadoInicial, type Estado } from "./comparador.js";
import type { Snapshot } from "./snapshot.js";

const RealDate = Date;

/** Fija el reloj: el aviso de horas depende del día y la hora de Lima. */
function reloj(iso: string): void {
  const fijo = new RealDate(iso).getTime();
  globalThis.Date = class extends RealDate {
    constructor(...args: any[]) {
      if (args.length) super(...(args as [any]));
      else super(fijo);
    }
    static now() {
      return fijo;
    }
  } as DateConstructor;
}

afterEach(() => {
  globalThis.Date = RealDate;
});

function foto(extra: Partial<Snapshot> = {}): Snapshot {
  return {
    usuario: "ana",
    tomada: "",
    issuesAsignados: [],
    todos: [],
    mrsReview: [],
    mrsMios: [],
    pipelines: [],
    horas: null,
    ...extra
  };
}

function pipeline(project: string, id: number, status: string): Snapshot["pipelines"][number] {
  return {
    project,
    producto: "sigo",
    productoNombre: "SIGO",
    grupo: "g",
    nombre: project,
    id,
    status,
    ref: "main",
    url: "",
    despliegues: [],
    fallidos: []
  };
}

const sembrado = (): Estado => ({ ...estadoInicial(), sembrado: true });

test("comparar: un repo que entra al set ya fallido no es novedad", () => {
  const { avisos } = comparar(foto({ pipelines: [pipeline("nuevo", 7, "failed")] }), sembrado());
  assert.equal(avisos.filter((a) => a.tipo === "pipeline").length, 0);
});

test("comparar: un repo vigilado que pasa a fallar sí avisa", () => {
  const previo = sembrado();
  previo.pipelines = { viejo: { id: 7, status: "success", despliegues: {} } };
  const { avisos } = comparar(foto({ pipelines: [pipeline("viejo", 8, "failed")] }), previo);
  assert.equal(avisos.filter((a) => a.tipo === "pipeline").length, 1);
});

test("comparar: horas parciales no disparan el recordatorio ni lo marcan como hecho", () => {
  reloj("2026-09-28T23:00:00Z"); // lunes 18:00 en Lima
  const horas = { horasHoy: 2, faltan: 7, completo: false, detalle: "", url: "", parcial: true };
  const { avisos, estado } = comparar(foto({ horas }), sembrado());
  assert.equal(avisos.filter((a) => a.tipo === "horas").length, 0);
  assert.equal(estado.horasAvisadas, null);
});
