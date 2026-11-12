# Evidencias

Reglas antes de guardar una captura o salida (CA-NF01.2, RNF-HU-10):

- Tapar el **Account ID**, ARNs completos, tokens (`eyJ…`), refresh tokens, correos reales y
  cualquier `Idempotency-Key`.
- Usar solo usuarios ficticios.
- Nombrar el archivo con el ID de la prueba (`T08-concurrencia.md`, `T14-mfa-gestor.md`, …) e
  incluir fecha, quién la ejecutó y el comando o pasos (ver `tests/manual/`).
