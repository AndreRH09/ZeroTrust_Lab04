#!/usr/bin/env node
// Genera docs/catalogo-pruebas.md y docs/catalogo-pruebas.csv a partir de:
//   - tests/catalogo/casos.mjs  (definición de cada caso: título, técnicas, pasos, entrada, esperado…)
//   - resultados REALES de Vitest (JSON por workspace) y Playwright (test-results/e2e/*.json).
// "Resultado Actual" y "Estado" nunca se escriben a mano: salen de la última ejecución.
// Falla (exit 1) si una prueba ejecutada no pertenece a ningún caso o si un caso automatizado no
// encuentra pruebas: así el catálogo registra TODAS las pruebas.
//
// Uso: npm run catalogo                 (ejecuta Vitest + Playwright y genera)
//      npm run catalogo -- --sin-ejecutar (solo regenera con los JSON existentes)
import { execSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { CASOS, HALLAZGOS, LEYENDA_MODULOS, NIVELES } from "../tests/catalogo/casos.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const WORKSPACES = ["shared", "backend", "frontend", "infra"];
const VITEST_DIR = join(ROOT, "test-results", "vitest");
const E2E_DIR = join(ROOT, "test-results", "e2e");
const ejecutar = !process.argv.includes("--sin-ejecutar");
const rel = (p) => relative(ROOT, p).replaceAll("\\", "/");

// ── 1. Ejecutar suites ────────────────────────────────────────────────────────────────────
if (ejecutar) {
  mkdirSync(VITEST_DIR, { recursive: true });
  // CLIs invocadas con node directamente (sin shell: portable y sin concatenar argumentos).
  const vitest = join(ROOT, "node_modules", "vitest", "vitest.mjs");
  const playwright = join(ROOT, "node_modules", "@playwright", "test", "cli.js");
  for (const ws of WORKSPACES) {
    console.log(`▶ Vitest · ${ws}`);
    const out = join(VITEST_DIR, `${ws}.json`);
    spawnSync(process.execPath, [vitest, "run", "--reporter=json", `--outputFile=${out}`], {
      cwd: join(ROOT, ws),
      stdio: "ignore",
    });
  }
  console.log("▶ Playwright · escritorio + móvil 375 px");
  // playwright.config.ts escribe test-results/e2e/resultados.json.
  spawnSync(process.execPath, [playwright, "test"], { cwd: ROOT, stdio: "ignore" });
}

// ── 2. Normalizar resultados ──────────────────────────────────────────────────────────────
/** @type {{origen:string, archivo:string, nombre:string, estado:'ok'|'fallo'|'omitida', proyecto?:string, error?:string}[]} */
const pruebas = [];
for (const ws of WORKSPACES) {
  const f = join(VITEST_DIR, `${ws}.json`);
  if (!existsSync(f)) throw new Error(`Falta ${rel(f)}: ejecuta sin --sin-ejecutar`);
  for (const archivo of JSON.parse(readFileSync(f, "utf8")).testResults) {
    for (const a of archivo.assertionResults) {
      pruebas.push({
        origen: "vitest",
        archivo: rel(archivo.name),
        nombre: [...a.ancestorTitles, a.title].join(" > "),
        estado: a.status === "passed" ? "ok" : a.status === "failed" ? "fallo" : "omitida",
        error: a.failureMessages?.[0]?.split("\n")[0],
      });
    }
  }
}
for (const reporte of ["resultados", "produccion"]) {
  const f = join(E2E_DIR, `${reporte}.json`);
  if (!existsSync(f)) continue;
  const recorrer = (suite, titulos) => {
    const t = suite.title && !suite.title.endsWith(".ts") ? [...titulos, suite.title] : titulos;
    for (const s of suite.suites ?? []) recorrer(s, t);
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests) {
        const ultimo = test.results.at(-1);
        pruebas.push({
          origen: reporte === "produccion" ? "e2e-produccion" : "e2e",
          archivo: `tests/e2e/${spec.file.replaceAll("\\", "/")}`,
          nombre: [...t, spec.title].join(" > "),
          proyecto: test.projectName,
          estado:
            test.status === "expected" || test.status === "flaky"
              ? "ok"
              : test.status === "skipped"
                ? "omitida"
                : "fallo",
          error: ultimo?.error?.message?.split("\n")[0],
        });
      }
    }
  };
  for (const s of JSON.parse(readFileSync(f, "utf8")).suites) recorrer(s, []);
}

// ── 3. Asociar pruebas ↔ casos ────────────────────────────────────────────────────────────
const errores = [];
const asignadas = new Map();
const filas = CASOS.map((c) => {
  const fila = { ...c, pruebas: [] };
  if (c.auto) {
    const re = c.auto.titulo ?? new RegExp(`${c.id}\\b`);
    fila.pruebas = pruebas.filter((p) => p.archivo === c.auto.archivo && re.test(p.nombre));
    for (const p of fila.pruebas) {
      const previo = asignadas.get(p);
      if (previo) errores.push(`La prueba «${p.nombre}» coincide con ${previo} y con ${c.id}`);
      asignadas.set(p, c.id);
    }
    if (fila.pruebas.length === 0 && !c.auto.opcional)
      errores.push(`${c.id}: no encontró pruebas en ${c.auto.archivo}`);
  }
  return fila;
});
const huerfanas = pruebas.filter((p) => !asignadas.has(p));
for (const p of huerfanas)
  errores.push(`Prueba sin caso en el catálogo: ${p.archivo} › ${p.nombre}`);
const ids = new Set();
for (const c of CASOS) {
  if (ids.has(c.id)) errores.push(`ID repetido: ${c.id}`);
  ids.add(c.id);
}

// ── 4. Resultado actual y estado ──────────────────────────────────────────────────────────
const plural = (n, s) => `${n} ${s}${n === 1 ? "" : "s"}`;
for (const f of filas) {
  if (!f.auto) {
    f.actual = f.manual.resultado;
    f.estado = { aprobado: "✅ Aprobado", pendiente: "⏳ Pendiente", fallido: "❌ Fallido" }[
      f.manual.estado
    ];
    continue;
  }
  const ok = f.pruebas.filter((p) => p.estado === "ok").length;
  const fallos = f.pruebas.filter((p) => p.estado === "fallo");
  const omitidas = f.pruebas.filter((p) => p.estado === "omitida").length;
  const NOMBRE = {
    escritorio: "escritorio",
    "movil-375": "móvil 375 px",
    produccion: "CloudFront",
  };
  const proyectos = [...new Set(f.pruebas.map((p) => p.proyecto).filter(Boolean))].map(
    (p) => NOMBRE[p] ?? p,
  );
  const donde = proyectos.length > 1 ? `; ${proyectos.join(" y ")}` : "";
  if (f.pruebas.length === 0) {
    f.actual = f.auto.notaSinEjecutar ?? "No ejecutada en esta corrida";
    f.estado = "⏭️ No ejecutada";
  } else if (fallos.length) {
    f.actual = `Difiere: ${fallos.length} de ${plural(f.pruebas.length, "prueba")} falló — ${fallos[0].error ?? fallos[0].nombre}`;
    f.estado = "❌ Fallido";
  } else if (omitidas === f.pruebas.length) {
    f.actual = f.auto.notaOmitida ?? `Omitida (${plural(omitidas, "prueba")})`;
    f.estado = "⏭️ Omitido";
  } else {
    f.actual = `Igual al esperado (${plural(ok, "prueba")}${donde})${omitidas ? `; ${omitidas} omitida(s)` : ""}`;
    f.estado = "✅ Aprobado";
  }
}

// ── 5. Escribir Markdown y CSV ────────────────────────────────────────────────────────────
const celda = (v) =>
  String(v ?? "")
    .replaceAll("|", "\\|")
    .replaceAll("\n", "<br>");
const pasosMd = (p) => p.map((x, i) => `${i + 1}. ${x}`).join("<br>");
const sha = (() => {
  try {
    const s = execSync("git rev-parse --short HEAD", { cwd: ROOT }).toString().trim();
    const sucio = execSync("git status --porcelain", { cwd: ROOT }).toString().trim()
      ? " + cambios sin commit"
      : "";
    return `${s}${sucio}`;
  } catch {
    return "desconocido";
  }
})();
const ahora = new Date().toLocaleString("es-PE", {
  timeZone: "America/Lima",
  dateStyle: "long",
  timeStyle: "short",
});
const contar = (lista, estado) => lista.filter((f) => f.estado.startsWith(estado)).length;
const ejecutadas = (lista) => lista.reduce((s, f) => s + f.pruebas.length, 0);

const md = [];
md.push("# Catálogo de casos de prueba — Plataforma de Donaciones Seguras", "");
md.push(
  `> Generado por \`npm run catalogo\` el **${ahora}** (hora de Lima) sobre el commit \`${sha}\`.`,
  "> **No editar a mano.** Los casos se definen en `tests/catalogo/casos.mjs`; «Resultado Actual» y «Estado»",
  "> salen de los reportes JSON de Vitest y Playwright de esa ejecución. Los casos ejecutados en AWS",
  "> toman su resultado de la evidencia firmada en `evidence/`.",
  "",
);

md.push("## Resumen", "");
md.push(
  "| Nivel | Herramienta | Casos | Pruebas ejecutadas | ✅ Aprobados | ❌ Fallidos | ⏭️ / ⏳ Sin ejecutar o pendientes |",
);
md.push("|---|---|---:|---:|---:|---:|---:|");
for (const n of NIVELES) {
  const l = filas.filter((f) => f.id.startsWith(`CP-${n.codigo}-`));
  md.push(
    `| ${n.nombre} | ${n.herramienta} | ${l.length} | ${ejecutadas(l)} | ${contar(l, "✅")} | ${contar(l, "❌")} | ${l.length - contar(l, "✅") - contar(l, "❌")} |`,
  );
}
md.push(
  `| **Total** | | **${filas.length}** | **${ejecutadas(filas)}** | **${contar(filas, "✅")}** | **${contar(filas, "❌")}** | **${filas.length - contar(filas, "✅") - contar(filas, "❌")}** |`,
  "",
);

md.push("## Cómo leer el catálogo", "");
md.push("**ID CP:** `CP-<NIVEL>-<MÓDULO>-<NNN>`.", "");
md.push("| Nivel | Significado |", "|---|---|");
for (const n of NIVELES) md.push(`| \`${n.codigo}\` | ${n.nombre}: ${n.descripcion} |`);
md.push("", "| Módulo | Significado |", "|---|---|");
for (const [k, v] of Object.entries(LEYENDA_MODULOS)) md.push(`| \`${k}\` | ${v} |`);
md.push(
  "",
  "**Técnicas:** ECP = partición en clases de equivalencia · AVL = análisis de valores límite · TD = tabla de decisión · TE = transición de estados · CU = caso de uso / flujo principal · PN = prueba negativa · CE = conjetura de errores · PC = prueba de contrato o configuración · CON = concurrencia · A11Y = accesibilidad (WCAG 2.2 AA).",
  "",
  "**Estado:** ✅ Aprobado (todas sus pruebas pasaron) · ❌ Fallido (al menos una falló) · ⏭️ Omitido / No ejecutada (la prueba existe pero requiere un entorno que no estaba disponible en esta corrida) · ⏳ Pendiente (aún no se ejecuta; requiere AWS o una persona).",
  "",
  "**Prioridad:** Alta = control de seguridad o regla de negocio del MVP · Media = comportamiento importante con mitigación · Baja = presentación o conveniencia.",
  "",
  "**Resultado Actual** indica cuántas pruebas automatizadas implementan el caso; en E2E se cuenta cada navegador (escritorio y móvil 375 px).",
  "",
);

if (HALLAZGOS.length) {
  md.push("## Defectos encontrados en esta campaña", "");
  md.push("| # | Defecto | Detectado por | Corrección | Estado |", "|---|---|---|---|---|");
  HALLAZGOS.forEach((h, i) =>
    md.push(
      `| ${i + 1} | ${celda(h.defecto)} | ${celda(h.detectadoPor)} | ${celda(h.correccion)} | ${h.estado} |`,
    ),
  );
  md.push("");
}

const COLS =
  "| ID CP | Título | Técnicas | Pasos | Entrada | Resultado Esperado | Resultado Actual | Estado | Prioridad |";
for (const n of NIVELES) {
  const l = filas.filter((f) => f.id.startsWith(`CP-${n.codigo}-`));
  if (!l.length) continue;
  md.push(`## ${n.nombre} (${l.length} casos)`, "", n.descripcion, "");
  md.push(COLS, "|---|---|---|---|---|---|---|---|---|");
  for (const f of l)
    md.push(
      `| ${f.id} | ${celda(f.titulo)} | ${celda(f.tecnicas)} | ${pasosMd(f.pasos)} | ${celda(f.entrada)} | ${celda(f.esperado)} | ${celda(f.actual)} | ${f.estado} | ${f.prioridad} |`,
    );
  md.push("");
}

md.push("## Trazabilidad", "", "| ID CP | Requisitos | Implementación |", "|---|---|---|");
for (const f of filas) {
  const impl = f.auto
    ? `\`${f.auto.archivo}\``
    : f.manual.evidencia
      ? `\`${f.manual.evidencia}\``
      : "—";
  md.push(`| ${f.id} | ${celda(f.requisitos)} | ${impl} |`);
}
md.push("");

const docs = join(ROOT, "docs");
writeFileSync(join(docs, "catalogo-pruebas.md"), md.join("\n"));

const csv = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
const lineas = [
  [
    "ID CP",
    "Título",
    "Técnicas",
    "Pasos",
    "Entrada",
    "Resultado Esperado",
    "Resultado Actual",
    "Estado",
    "Prioridad",
    "Requisitos",
    "Implementación",
  ]
    .map(csv)
    .join(","),
];
for (const f of filas)
  lineas.push(
    [
      f.id,
      f.titulo,
      f.tecnicas,
      f.pasos.map((x, i) => `${i + 1}. ${x}`).join("\n"),
      f.entrada,
      f.esperado,
      f.actual,
      f.estado,
      f.prioridad,
      f.requisitos,
      f.auto?.archivo ?? f.manual?.evidencia ?? "",
    ]
      .map(csv)
      .join(","),
  );
writeFileSync(join(docs, "catalogo-pruebas.csv"), "\uFEFF" + lineas.join("\r\n")); // BOM: Excel abre UTF-8

// ── 6. Resumen en consola ─────────────────────────────────────────────────────────────────
console.log(
  `\nCatálogo: ${filas.length} casos · ${ejecutadas(filas)} pruebas ejecutadas · ✅ ${contar(filas, "✅")} · ❌ ${contar(filas, "❌")} · otros ${filas.length - contar(filas, "✅") - contar(filas, "❌")}`,
);
console.log("→ docs/catalogo-pruebas.md y docs/catalogo-pruebas.csv");
if (errores.length) {
  console.error(`\n${errores.length} problema(s) de integridad del catálogo:`);
  for (const e of errores) console.error(` - ${e}`);
  process.exit(1);
}
