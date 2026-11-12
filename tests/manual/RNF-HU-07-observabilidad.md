<!-- @trace RNF-HU-07, CA-NF07.1, CA-NF07.2 -->
# Logs y trazabilidad

1. CloudWatch Logs Insights sobre los log groups de las funciones (retención 14 días):
   ```
   fields timestamp, requestId, action, outcome, statusCode, durationMs
   | filter statusCode in [200, 201, 401, 403]
   | sort timestamp desc | limit 20
   ```
2. Mostrar un caso 2xx y uno 403 (`AUTHZ_DENIED`) por `requestId`. Los 401 los emite API Gateway:
   verlos en el log de acceso de la API (`authorizerError`).
3. Confirmar que ninguna línea contiene `Authorization`, tokens, `sub` ni `Idempotency-Key`
   (el logger los redacta; ver `backend/test/unit/shared/http.test.ts`).
4. CloudTrail → Event history: evento `UpdateStack`/`CreateChangeSet` del despliegue.
5. Guardar en `evidence/RNF-HU-07-observabilidad.md`.
