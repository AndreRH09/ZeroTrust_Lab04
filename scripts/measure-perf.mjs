#!/usr/bin/env node
// RNF-HU-05 (CA-NF05.1, CA-NF05.2): siembra hasta 50 proyectos publicados y mide el p95 de los GET
// públicos excluyendo la primera llamada (cold start).
// Uso: API_URL=... GESTOR_TOKEN=... node scripts/measure-perf.mjs [--seed] [--n 100]
const API = (process.env.API_URL ?? "").replace(/\/+$/, "");
const TOKEN = process.env.GESTOR_TOKEN;
const args = process.argv.slice(2);
const N = Number(args[args.indexOf("--n") + 1]) || 100;
if (!API) {
  console.error("Define API_URL (salida ApiUrl de la pila).");
  process.exit(1);
}

async function seed() {
  if (!TOKEN) throw new Error("--seed requiere GESTOR_TOKEN");
  const headers = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };
  const current = await (await fetch(`${API}/v1/projects`)).json();
  for (let i = current.items.length; i < 50; i++) {
    const r = await fetch(`${API}/v1/projects`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: `Proyecto ficticio ${i + 1}`,
        description: "Proyecto de prueba para medición de rendimiento (RNF-HU-05).",
        goalAmountCents: 100000 + i * 1000,
      }),
    });
    const p = await r.json();
    await fetch(`${API}/v1/projects/${p.projectId}/publish`, { method: "PATCH", headers });
  }
}

async function measure(path) {
  await fetch(`${API}${path}`); // calentamiento (excluye cold start)
  const times = [];
  for (let i = 0; i < N; i++) {
    const t0 = performance.now();
    const r = await fetch(`${API}${path}`);
    await r.arrayBuffer();
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  const pct = (p) => times[Math.min(times.length - 1, Math.ceil((p / 100) * times.length) - 1)];
  return {
    path,
    n: N,
    p50: pct(50).toFixed(0),
    p95: pct(95).toFixed(0),
    max: times.at(-1).toFixed(0),
  };
}

if (args.includes("--seed")) await seed();
const list = await (await fetch(`${API}/v1/projects`)).json();
const first = list.items[0]?.projectId;
const rows = [await measure("/v1/projects")];
if (first)
  rows.push(await measure(`/v1/projects/${first}`), await measure(`/v1/projects/${first}/stats`));
console.log(
  `Proyectos publicados: ${list.items.length} · Node ${process.version} · ${new Date().toISOString()}`,
);
console.table(rows);
const ok = rows.every((r) => Number(r.p95) <= 1500);
console.log(ok ? "CA-NF05.1 cumple: p95 ≤ 1500 ms" : "CA-NF05.1 NO cumple");
process.exit(ok ? 0 : 1);
