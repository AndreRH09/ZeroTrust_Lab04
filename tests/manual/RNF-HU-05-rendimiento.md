<!-- @trace RNF-HU-05, CA-NF05.1, CA-NF05.2 -->
# Rendimiento de GET con 50 proyectos

- **Herramienta:** `scripts/measure-perf.mjs` (Node 24, `fetch`, `performance.now()`).
- **Método:** `API_URL=… GESTOR_TOKEN=… node scripts/measure-perf.mjs --seed --n 100`.
  Siembra hasta 50 proyectos publicados, descarta la primera llamada (cold start) y calcula p50/p95
  sobre 100 solicitudes secuenciales por ruta.
- **Condiciones a registrar:** ubicación del cliente (región cercana a `us-east-2` o CloudShell),
  fecha/hora, memoria Lambda (256 MB, arm64), número de proyectos.
- **Criterio:** p95 ≤ 1500 ms en `/v1/projects`, detalle y `stats`.
- Guardar la tabla en `evidence/RNF-HU-05-rendimiento.md`.
