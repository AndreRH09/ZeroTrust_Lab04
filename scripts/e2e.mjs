#!/usr/bin/env node
// Lanzador multiplataforma de Playwright (las variables en scripts npm no son portables a cmd).
//   node scripts/e2e.mjs capturas                 → capturas de todas las pantallas en capturas/
//   node scripts/e2e.mjs produccion <https://…>   → smoke de solo lectura contra el frontend desplegado
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const [modo, ...resto] = process.argv.slice(2);
const env = { ...process.env };

if (modo === "capturas") {
  env.E2E_CAPTURAS = "1";
} else if (modo === "produccion") {
  const url = resto[0]?.startsWith("https://") ? resto.shift() : env.E2E_PUBLIC_URL;
  if (!url) {
    console.error(
      "Indica la URL HTTPS del frontend: npm run e2e:produccion -- https://<dist>.cloudfront.net",
    );
    process.exit(2);
  }
  env.E2E_PUBLIC_URL = url;
} else {
  console.error("Uso: node scripts/e2e.mjs <capturas|produccion> [args de playwright]");
  process.exit(2);
}

// CLI de Playwright con node directamente: sin shell, los argumentos no se concatenan.
const cli = fileURLToPath(new URL("../node_modules/@playwright/test/cli.js", import.meta.url));
const r = spawnSync(process.execPath, [cli, "test", ...resto], { stdio: "inherit", env });
process.exit(r.status ?? 1);
