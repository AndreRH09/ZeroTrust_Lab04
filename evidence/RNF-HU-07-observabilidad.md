<!-- @trace RNF-HU-07, CA-NF07.1, CA-NF07.2, CA-NF01.2 -->
# Logs y trazabilidad (T100)

| Campo | Valor |
|---|---|
| Fecha | 2026-11-11 (hora de Lima) |
| Ejecutó | Integrante DevOps/AWS |
| Entorno | Pila `zerotrust-lab04`, `us-east-2` |
| Procedimiento | `tests/manual/RNF-HU-07-observabilidad.md` |
| Método | CLI de solo lectura (`aws logs`, `aws cloudtrail lookup-events`); misma información que CloudWatch Logs Insights |

## Resultado

**Parcialmente aprobada.** Cumplen: retención de 14 días, formato JSON con los campos pedidos, ausencia de datos sensibles, caso exitoso y casos 401, y CloudTrail. **Pendiente:** el caso 403 (`AUTHZ_DENIED`), que requiere ejecutar la prueba T03 con un token de donante (ver §4).

## 1. Retención de 14 días (CA-NF07.1)

Los 8 grupos de logs de la pila (7 funciones y el log de acceso de la API) tienen `retentionInDays = 14`.

| Grupo | Retención (días) |
|---|---|
| `PublicProjectsLogGroup`, `ManageProjectsLogGroup`, `CreateDonationLogGroup`, `SimulateDonationLogGroup` | 14 |
| `ReadDonationsLogGroup`, `AuditLogGroup`, `PreAuthLogGroup`, `ApiAccessLogGroup` | 14 |

## 2. Caso exitoso con campos JSON (CA-NF07.1)

Log de la aplicación (`PublicProjectsFn`, `GET /v1/projects`):

```json
{"level":"INFO","timestamp":"2026-11-12T03:54:41.730Z","requestId":"GtXEPhXaCYcEPFg=","action":"GET /v1/projects","outcome":"SUCCESS","statusCode":200,"durationMs":301}
```

Creación de una donación (`CreateDonationFn`, `POST /v1/donations`):

```json
{"level":"INFO","timestamp":"2026-11-12T03:11:31.308Z","requestId":"GtQvYhh6CYcEPGg=","action":"POST /v1/donations","outcome":"SUCCESS","statusCode":201,"durationMs":794}
```

Cada línea incluye `requestId`, `action`, `outcome`, `statusCode` y `durationMs`, que permiten reconstruir una solicitud sin exponer datos del usuario. El `requestId` coincide con el de la respuesta de API Gateway y con el log de acceso.

## 3. Casos rechazados 401 (CA-NF07.2)

Los 401 los emite API Gateway antes de invocar la Lambda, por lo que aparecen en el **log de acceso de la API** con `authorizerError`:

```json
{"requestId":"GtW79g9biYcEPsQ=","routeKey":"GET /v1/donations/me","status":"401","responseLength":"26","responseLatency":"0","integrationLatency":"-","authorizerError":"missing: token not provided"}
{"requestId":"GtW8JjciiYcEPOw=","routeKey":"GET /v1/donations/me","status":"401","responseLength":"26","responseLatency":"0","integrationLatency":"-","authorizerError":"invalid_token: illegal base64 data at input byte 1"}
```

- `integrationLatency: "-"` confirma que la Lambda **no se invocó**: el autorizador JWT cortó la solicitud.
- Resumen del log de acceso revisado: 22 respuestas 200, 20 respuestas 204 (preflight CORS) y 18 respuestas 401.

## 4. Caso 403 (`AUTHZ_DENIED`): pendiente

Los 403 los emite la Lambda (módulo `authz`) y generan un `AuditEvent` con `eventType = AUTHZ_DENIED`. Para producirlo (prueba **T03**): obtener un token de `donante1` con `scripts/get-tokens.mjs` y llamar a `POST /v1/projects`, que debe responder 403. Después, anotar aquí:

- el `requestId` de la respuesta,
- la línea del log de `ManageProjectsFn` con `"outcome":"DENIED"` y `"statusCode":403`,
- el evento `AUTHZ_DENIED` de la tabla `AuditEvents` (con `actorRef` seudonimizado).

## 5. Sin datos sensibles en los logs (CA-NF01.2)

Se revisaron los eventos recientes de cada grupo en busca de `eyJ` (JWT), `Bearer `, `authorization`, `idempotency-key`, `AKIA` y `"sub"`:

| Grupo | Eventos revisados | Coincidencias sensibles |
|---|---|---|
| `PublicProjectsLogGroup` | 189 | 0 |
| `ManageProjectsLogGroup` | 21 | 0 |
| `CreateDonationLogGroup` | 5 | 0 |
| `SimulateDonationLogGroup` | 5 | 0 |
| `ReadDonationsLogGroup` | 5 | 0 |
| `PreAuthLogGroup` | 21 | 0 |
| `ApiAccessLogGroup` | 25 | 0 |
| `AuditLogGroup` | 0 | 0 (la función de auditoría no se ha invocado) |

El logger redacta las cabeceras y los campos sensibles (`backend/test/unit/shared/http.test.ts`), y el formato del log de acceso de la API no incluye la cabecera `Authorization`.

> **Nota metodológica:** una primera consulta con `filter-log-events --limit` devolvió vacío porque el CLI pagina y las primeras páginas llegan sin eventos; su resultado «ninguna coincidencia» **no era válido**. La verificación definitiva lee directamente los flujos de logs con `get-log-events` y cuenta los eventos revisados.

## 6. CloudTrail: cambios de infraestructura (CA-NF07.2)

Historial de eventos (`lookup-events`) de los despliegues de la pila, hora de Lima:

| Hora | Evento | Origen |
|---|---|---|
| 2026-11-11 20:07:39 | `CreateChangeSet` | `cloudformation.amazonaws.com` (primer intento de la pila base, revertido: ver `docs/aws-account.md` §9) |
| 2026-11-11 20:16:30 | `CreateChangeSet` | `cloudformation.amazonaws.com` |
| 2026-11-11 20:16:41 | `ExecuteChangeSet` | `cloudformation.amazonaws.com` |
| 2026-11-11 21:48:29 | `CreateChangeSet` | `cloudformation.amazonaws.com` |
| 2026-11-11 21:48:48 | `ExecuteChangeSet` | `cloudformation.amazonaws.com` |
| 2026-11-11 21:54:46 | `CreateChangeSet` | `cloudformation.amazonaws.com` |
| 2026-11-11 21:55:39 | `ExecuteChangeSet` | `cloudformation.amazonaws.com` |
| 2026-11-11 22:08:36 | `CreateChangeSet` | `cloudformation.amazonaws.com` |
| 2026-11-11 22:09:06 | `ExecuteChangeSet` | `cloudformation.amazonaws.com` |

Corresponden, en orden, al primer intento de la pila base (falló y se revirtió), el segundo intento que sí se completó, el despliegue completo, el registro de `WebOrigin` y la corrección de CORS. Captura de la consola: CloudTrail → *Event history*, `evidence/img/RNF-HU-07-cloudtrail.png`.

## Qué demuestra

- **CA-NF07.1:** logs JSON con `requestId`, acción, resultado, código HTTP y duración; retención de 14 días.
- **CA-NF07.2 (parcial):** caso exitoso y casos 401 visibles; CloudTrail registra los cambios de infraestructura. Falta el caso 403.
- **CA-NF01.2:** ningún log contiene tokens, llaves ni identidades en claro.
