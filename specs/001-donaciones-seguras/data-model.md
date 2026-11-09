# Data Model — 001-donaciones-seguras

Base: spec §Key Entities, `design.md` §5. Todas las tablas DynamoDB on-demand, cifrado en reposo
por defecto (clave administrada por AWS), sin streams.

## Projects

| Atributo | Tipo | Reglas |
|---|---|---|
| `projectId` (PK) | string UUID | generado en servidor |
| `title` | string | 3–120 caracteres, trim |
| `description` | string | 10–2000 caracteres |
| `goalAmountCents` | integer | 100 ≤ x ≤ 100 000 000 (S/ 1 000 000) |
| `confirmedAmountCents` | integer | ≥ 0; solo lo modifica `simulateDonationFn` |
| `currency` | `"PEN"` | constante |
| `status` | `BORRADOR` \| `PUBLICADO` | ver transiciones |
| `createdAt`, `updatedAt` | ISO-8601 UTC | servidor |
| `createdByRef` | string | seudónimo del GESTOR creador |

- **GSI `status-createdAt`**: PK `status`, SK `createdAt` → catálogo (PUBLICADO) y gestión (BORRADOR).
- **Transiciones**: `BORRADOR → PUBLICADO` (solo GESTOR, condición `status = BORRADOR`; si no → 409).
  Edición permitida solo en `BORRADOR` (condición en `UpdateItem`; si no → 409). Sin cierre por meta.
- Límite superior de `goalAmountCents`: supuesto razonable (no fijado en requirements); evita overflow.

## Donations

| Atributo | Tipo | Reglas |
|---|---|---|
| `donationId` (PK) | string UUID | servidor |
| `projectId` | string UUID | proyecto PUBLICADO al crear |
| `donorSub` | string | **solo** del claim `sub` verificado |
| `amountCents` | integer | 100 ≤ x ≤ 100 000 |
| `currency` | `"PEN"` | constante |
| `status` | `PENDIENTE_SIMULACION` \| `CONFIRMADA_SIMULADA` \| `RECHAZADA_SIMULADA` | |
| `createdAt`, `updatedAt` | ISO-8601 UTC | |

- **GSI `donorSub-createdAt`**: historial propio (`GET /v1/donations/me`), orden descendente.
- **Transiciones** (una sola vez, atómica):

  ```text
  PENDIENTE_SIMULACION ──confirm──► CONFIRMADA_SIMULADA   (+amountCents a Project.confirmedAmountCents)
  PENDIENTE_SIMULACION ──reject───► RECHAZADA_SIMULADA    (sin cambio en totales)
  estado terminal ──cualquier──► 409
  ```

  `TransactWriteItems`: Update Donation (`status = PENDIENTE_SIMULACION AND donorSub = :sub`) +
  Update Project (`ADD confirmedAmountCents :amount`, solo en confirm).

## Idempotency

| Atributo | Tipo | Reglas |
|---|---|---|
| `pk` (PK) | string | `donorSub#createDonation#idempotencyKey` |
| `payloadHash` | string hex | SHA-256 de `{ projectId, amountCents }` canónico |
| `donationId` | string UUID | donación creada |
| `responseStatus` | integer | `201` |
| `responseBody` | map | respuesta devuelta en la primera llamada |
| `expiresAt` | number (epoch s) | primera escritura + 86 400; atributo TTL |

- Se escribe en la misma transacción que la Donation (`attribute_not_exists(pk)`).
- Lectura: si `expiresAt < now` se ignora (TTL puede tardar en borrar).

## AuditEvents

| Atributo | Tipo | Reglas |
|---|---|---|
| `eventType` (PK) | enum | `PROJECT_CREATED`, `PROJECT_UPDATED`, `PROJECT_PUBLISHED`, `DONATION_CREATED`, `DONATION_CONFIRMED`, `DONATION_REJECTED`, `AUTHZ_DENIED` |
| `sk` (SK) | string | `timestamp#eventId` |
| `eventId` | string UUID | |
| `timestamp` | ISO-8601 UTC | |
| `requestId` | string | `requestContext.requestId` |
| `actorRef` | string | `HMAC-SHA256(sub, pepper)` (research R-08) |
| `action` | string | método + ruta lógica |
| `resourceRef` | string | `project:<id>` \| `donation:<id>` |
| `outcome` | `SUCCESS` \| `DENIED` \| `CONFLICT` | |

- Nunca contiene tokens, claves de idempotencia, importes ni `sub` en claro (CA-10.2).
- Consulta HU-10: `Query eventType = :t AND sk BETWEEN :from AND :to`.

## Invariantes verificables

| Invariante | Mecanismo | Prueba |
|---|---|---|
| Dinero en enteros | Zod `z.number().int()` + tipos `number` enteros; sin `float` en cálculos | T04 |
| Una clave por usuario y operación | PK compuesta + `attribute_not_exists` | T06, T07 |
| Confirmación una sola vez | condición `status = PENDIENTE_SIMULACION` | T08 |
| Historial solo propietario | Query por GSI con `sub` del token; GetItem compara `donorSub` | T09, T12 |
| Solo PUBLICADO acepta donaciones | `ConditionCheck` en la transacción | CA-05.2 |
