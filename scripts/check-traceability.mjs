#!/usr/bin/env node
// T101 · Principio VIII: cada HU/CA/RNF-HU del MVP debe aparecer en la cabecera @trace de al menos
// una prueba (automática o procedimiento manual). Falla también si un archivo de prueba no tiene
// cabecera @trace.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const TEST_DIRS = [
  "shared/test",
  "backend/test",
  "frontend/test",
  "infra/test",
  "tests/api",
  "tests/manual",
];
const TEST_FILE = /(\.test\.tsx?|\.bru|\.md)$/;
const HELPER = /(helpers|utils|setup)\.tsx?$|README\.md$|collection\.bru$|environments/;

function walk(dir) {
  let out = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out = out.concat(walk(p));
    else out.push(p);
  }
  return out;
}

// IDs del MVP (requirements.md §5): HU-01..HU-09, HU-11, RNF-HU-01..11 y sus CA.
const req = readFileSync(join(ROOT, "requirements.md"), "utf8");
const EXTENSION = new Set(["HU-10", "HU-12"]);
const required = new Set();
let current = null;
for (const line of req.split("\n")) {
  const h = /^\*\*(HU-\d{2}|RNF-HU-\d{2})\b/.exec(line);
  if (h) {
    current = h[1];
    if (!EXTENSION.has(current)) required.add(current);
    continue;
  }
  if (current && !EXTENSION.has(current)) {
    for (const m of line.matchAll(/\*\*(CA-(?:NF)?\d{2}\.\d):?\*\*/g)) required.add(m[1]);
  }
  if (/^## /.test(line)) current = null;
}

const found = new Set();
const missingHeader = [];
for (const dir of TEST_DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    if (!TEST_FILE.test(file) || HELPER.test(file)) continue;
    const text = readFileSync(file, "utf8");
    const header = /@trace\s+([^\n]+)/.exec(text);
    if (!header) {
      missingHeader.push(relative(ROOT, file));
      continue;
    }
    for (const id of header[1].match(/\b(?:RNF-HU-\d{2}|HU-\d{2}|CA-(?:NF)?\d{2}\.\d|T\d{2})\b/g) ??
      []) {
      found.add(id);
    }
  }
}

const missing = [...required].filter((id) => !found.has(id)).sort();
const tests = [...Array(14)].map((_, i) => `T${String(i + 1).padStart(2, "0")}`);
const missingT = tests.filter((t) => !found.has(t));

console.log(`IDs MVP requeridos: ${required.size} · cubiertos: ${required.size - missing.length}`);
if (missingHeader.length)
  console.error(`Archivos de prueba sin @trace:\n  ${missingHeader.join("\n  ")}`);
if (missing.length) console.error(`IDs sin prueba: ${missing.join(", ")}`);
if (missingT.length) console.error(`Pruebas de aceptación sin referencia: ${missingT.join(", ")}`);
if (missingHeader.length || missing.length || missingT.length) process.exit(1);
console.log("Trazabilidad completa: T01–T14 y todos los HU/CA/RNF-HU del MVP.");
