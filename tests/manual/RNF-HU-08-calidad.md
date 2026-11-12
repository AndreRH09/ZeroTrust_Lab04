<!-- @trace RNF-HU-08, CA-NF08.1, CA-NF08.2 -->
# Calidad y reproducibilidad

1. Cada PR ejecuta `.github/workflows/ci.yml`: lint, formato, typecheck, tests, trazabilidad, build y
   `npm audit --audit-level=high`. Proteger `main` con 1 revisión y CI obligatorio.
2. Infraestructura reproducible: `npm run deploy:api` y `npm run deploy:web` (AWS SAM).
3. Eliminación: `scripts/cleanup.sh` (`sam delete`). Pasos en el README.
