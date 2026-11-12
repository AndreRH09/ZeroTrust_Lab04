# Procedimientos de prueba manuales

Pruebas que dependen de la cuenta AWS, del navegador o de una persona (no automatizables en CI).
Cada archivo declara su `@trace` y deja el resultado en `evidence/` siguiendo `evidence/README.md`.
`scripts/check-traceability.mjs` los incluye en el control de trazabilidad.
