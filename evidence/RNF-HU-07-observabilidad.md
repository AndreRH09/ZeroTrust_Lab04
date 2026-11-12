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

**Aprobada.** Cumplen: retención de 14 días, formato JSON con los campos pedidos, ausencia de datos sensibles, caso exitoso, casos 401 y 403 (con su evento de auditoría `AUTHZ_DENIED`), y CloudTrail.

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

## 4. Caso 403 (`AUTHZ_DENIED`) · prueba T03

Los 403 los emite la Lambda (módulo `authz`), no API Gateway: el token es válido pero el rol no alcanza. Se produjo con un token de `donante1` (obtenido con `scripts/get-tokens.mjs`) llamando a `POST /v1/projects`, operación reservada al grupo `GESTOR` (CA-04.1):

```bash
curl -i -X POST "$API_URL/v1/projects" -H "Authorization: Bearer $DONOR_TOKEN" -H "Content-Type: application/json" -d '{"title":"Prueba T03","description":"Un donante no puede crear proyectos","goalAmountCents":100000}'
```

Respuesta (`requestId` = `GtbR0hGOiYcEMpw=`):

```text
HTTP/1.1 403 Forbidden
{"code":"FORBIDDEN","message":"Operación no permitida","requestId":"GtbR0hGOiYcEMpw="}
```

El mismo `requestId` aparece en tres registros:

1. **Log de acceso de la API** (el token pasó el autorizador: `authorizerError` es `-`):

```json
{"requestId":"GtbR0hGOiYcEMpw=","routeKey":"POST /v1/projects","status":"403","responseLength":"87","responseLatency":"1054","integrationLatency":"978","authorizerError":"-"}
```

2. **Log de la Lambda `ManageProjectsFn`:**

```json
{"level":"WARN","timestamp":"2026-11-12T04:23:27.435Z","requestId":"GtbR0hGOiYcEMpw=","action":"POST /v1/projects","outcome":"DENIED","statusCode":403,"durationMs":480}
```

3. **Tabla `AuditEvents`** (consulta `eventType = AUTHZ_DENIED`):

| Campo | Valor |
|---|---|
| `eventType` | `AUTHZ_DENIED` |
| `timestamp` | `2026-11-12T04:23:26.968Z` |
| `requestId` | `GtbR0hGOiYcEMpw=` |
| `actorRef` | `ca27f9efebcbf7184292f0684497e1e3` (seudónimo: HMAC del `sub`, no el `sub`) |
| `action` | `projects:create` |
| `resourceRef` | `POST /v1/projects` |
| `outcome` | `DENIED` |

El evento no contiene tokens, importes, claves de idempotencia ni el `sub` en claro (CA-10.2).

**Diferencia entre 401 y 403:** el 401 (§3) lo emite API Gateway antes de invocar la Lambda (`integrationLatency: "-"`); el 403 lo emite la Lambda tras validar el grupo del usuario (`integrationLatency` > 0) y deja evidencia en el log y en la auditoría.

> **Nota de la ejecución:** las dos primeras llamadas devolvieron 401 (`invalid number of segments`) porque al copiar el token de la terminal se colaron saltos de línea en la variable. Se limpió con `tr -d '\n\r '` y la tercera llamada dio el 403. El token no se guardó en ningún archivo.

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
- **CA-NF07.2:** un caso exitoso y casos rechazados 401 y 403 visibles en CloudWatch; CloudTrail registra los cambios de infraestructura.
- **CA-04.1 (T03):** un donante no puede crear proyectos; la denegación queda auditada con un actor seudonimizado.
- **CA-NF01.2:** ningún log contiene tokens, llaves ni identidades en claro.
git add evidence/RNF-HU-07-observabilidad.md AI_USAGE.md