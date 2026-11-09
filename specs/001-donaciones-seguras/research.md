# Research — 001-donaciones-seguras

Fuente técnica: `design.md` v2.0 (AD-01…AD-08, §2 stack, §4 contratos, §5 datos, §6 seguridad).
Aquí solo se registran decisiones que `design.md` no fija o que la especificación aclarada cambia.

## R-01 Región AWS

- **Decision**: `us-east-2` para todos los recursos regionales (Cognito, API Gateway, Lambda,
  DynamoDB, S3, CloudWatch). CloudFront es global; no se requiere ACM en `us-east-1` porque se usa
  el dominio por defecto `*.cloudfront.net`.
- **Rationale**: coincide con AD-06 y con el perfil `zerotrust-lab04` en `~/.aws/config`. El
  endpoint `aws-mcp.us-east-1` del Agent Toolkit es solo el servidor MCP, no aloja recursos.
- **Alternatives**: `us-east-1` (descartada: el proyecto tiene una sola región asignada).
- **Acción**: confirmar en AWS Settings > View all projects > Overview > Additional Info > Region.

## R-02 MFA solo para GESTOR/AUDITOR

- **Hallazgo**: la configuración MFA de Cognito es por user pool (`OFF` | `OPTIONAL` | `ON`), no
  por grupo. Con `OPTIONAL`, managed login **no** pide enrolar MFA; solo desafía a usuarios que ya
  tienen un factor preferido.
- **Decision** (respeta la matriz: MFA obligatorio solo GESTOR/AUDITOR, opcional DONANTE):
  - User pool con `MfaConfiguration: OPTIONAL`, solo TOTP (`EnabledMfas: [SOFTWARE_TOKEN_MFA]`,
    sin `SmsConfiguration`).
  - **Trigger Pre authentication** (`PreAuthFn`): si el usuario pertenece a `GESTOR` o `AUDITOR`
    y su `UserMFASettingList` no incluye `SOFTWARE_TOKEN_MFA` como preferido, lanza error y
    Cognito **no emite tokens** (CA-11.2, T14). Con TOTP preferido, Cognito exige el código en
    cada inicio de sesión.
  - Enrolamiento de privilegiados durante la preparación (no por la SPA): app client
    `admin-cli` sin OAuth, solo `ALLOW_ADMIN_USER_PASSWORD_AUTH` (usable únicamente con
    credenciales IAM del equipo) → `associate-software-token` → `verify-software-token` →
    `set-user-mfa-preference` → recién entonces `admin-add-user-to-group`.
  - El app client de la SPA **no** concede el scope `aws.cognito.signin.user.admin`, así que un
    usuario no puede desactivar su propio MFA; aunque lo hiciera, el trigger bloquea el login.
- **Rationale**: único diseño con un solo user pool que cumple CA-11.1/CA-11.2 sin forzar MFA a
  donantes y sin romper T03/T12 (un segundo pool devolvería 401 en lugar de 403/404).
- **IAM**: `PreAuthFn` necesita `cognito-idp:AdminGetUser` y `cognito-idp:AdminListGroupsForUser`.
  El ARN del pool no puede referenciarse sin dependencia circular (pool → trigger → política →
  pool), por lo que el recurso es `arn:aws:cognito-idp:${Region}:${Account}:userpool/*`.
  Excepción justificada a documentar en `design.md` (principio IV).
- **Limitación**: el trigger no corre en la renovación con refresh token (≤ 60 min), pero esos
  tokens solo existen si el login inicial pasó el control.
- **Alternatives**:
  - `MfaConfiguration: ON` para todos (descartada: contradice "opcional" para DONANTE).
  - Dos user pools con un JWT authorizer por grupo de rutas (descartada: T03/T12 recibirían 401
    del authorizer en vez de 403/404 de `authz`, incumpliendo CA-04.1/CA-04.2).
- **No incluido**: UI para que el DONANTE active MFA opcional (fuera de alcance del MVP).

## R-03 Scopes vs. grupos

- **Decision**: resource server `api` con scopes `projects.write`, `donations.write`,
  `donations.read`, `audit.read`. El app client público (sin secreto) los concede todos; el JWT
  authorizer exige el scope por ruta (PEP) y Lambda `authz` exige el grupo y propietario (PE).
- **Rationale**: en el plan Lite/Essentials los scopes del access token dependen del app client,
  no del grupo; personalizar el access token por grupo exige un plan de pago. El scope garantiza
  que un ID token (sin `scope`) sea rechazado (CA-NF02.1, T11); el grupo se valida en Lambda.
- **Alternatives**: pre token generation V2 para filtrar scopes por grupo (descartada: plan de pago).

## R-04 Tokens en el navegador

- **Decision**: `oidc-client-ts` con `InMemoryWebStorage` para `userStore` y `stateStore` en
  memoria durante el flujo; access token 15 min; refresh token 60 min con rotación y revocación
  habilitadas; `signoutRedirect` + `revokeTokens(["refresh_token"])` al cerrar sesión.
- **Rationale**: CA-03.3, CA-NF11.1. Recargar la página pierde la sesión (edge case aceptado);
  se recupera con la sesión de managed login sin reingresar credenciales mientras siga activa.
- **Alternatives**: Amplify Auth (usa `localStorage` por defecto; descartada).

## R-05 Una función Lambda por caso de uso agrupado

- **Decision**: 6 funciones con rol IAM propio:

  | Función | Rutas | Permisos DynamoDB |
  |---|---|---|
  | `publicProjectsFn` | GET projects, detalle, stats | Projects: GetItem, Query(GSI) |
  | `manageProjectsFn` | GET manage, POST, PATCH, publish | Projects: Get/Put/Update/Query(GSI); AuditEvents: PutItem |
  | `createDonationFn` | POST donations | Projects: GetItem/ConditionCheck; Donations: PutItem; Idempotency: GetItem/PutItem; AuditEvents: PutItem |
  | `simulateDonationFn` | POST simulate (solo stage `academic`) | Donations: Get/UpdateItem; Projects: UpdateItem; AuditEvents: PutItem |
  | `readDonationsFn` | GET me, GET by id | Donations: GetItem, Query(GSI); AuditEvents: PutItem |
  | `auditFn` (ext.) | GET audit | AuditEvents: Query |
  | `preAuthFn` | trigger Cognito (sin ruta) | sin DynamoDB; `cognito-idp:AdminGetUser`, `AdminListGroupsForUser` (R-02) |

- **Rationale**: principio IV y T10 (`publicProjectsFn` no puede escribir). Agrupar rutas del mismo
  dominio y mismo nivel de privilegio evita 11 funciones sin perder aislamiento.
- **Alternatives**: una función por módulo (descartada: `projects` mezclaría lectura pública y
  escritura); una por ruta (descartada: más cold starts y plantilla mayor sin beneficio IAM).

## R-06 Throttling (aclaración Q5)

- **Decision**: `DefaultRouteSettings` del stage HTTP API: `ThrottlingRateLimit: 20`,
  `ThrottlingBurstLimit: 40`; respuesta 429 la emite API Gateway.
- **Rationale**: FR-029; sin código y sin estado propio.

## R-07 Idempotencia (aclaración Q4)

- **Decision**: `payloadHash = SHA-256(JSON canónico de { projectId, amountCents })`;
  `expiresAt = now + 86400` (TTL DynamoDB). Lectura previa `GetItem` con `ConsistentRead`; si existe
  y no expiró → devolver respuesta almacenada (mismo hash) o 409 (hash distinto). Si no existe →
  `TransactWriteItems` [Put Idempotency `attribute_not_exists(pk)`, ConditionCheck Project
  `status = PUBLICADO`, Put Donation]. `TransactionCanceledException` → releer y resolver igual.
- **Rationale**: AD-05, CA-05.4. TTL de DynamoDB borra con retraso: se compara `expiresAt` en
  lectura además del TTL.

## R-08 Auditoría (aclaración Q3)

- **Decision**: `audit.record()` en: crear/editar/publicar proyecto, crear donación, simular
  confirmación/rechazo y toda denegación 403 de `authz`. `actorRef = HMAC-SHA256(sub, pepper)`
  con `pepper = AWS::StackId` inyectado como variable de entorno: no es secreto, pero el seudónimo
  no revela el `sub` y es estable dentro del despliegue (permite correlacionar acciones).
- **Rationale**: CA-10.2 pide seudónimo, no secreto criptográfico. Evita añadir SSM u otro servicio.
- **Alternatives**: SSM Parameter Store (descartada por alcance); `sub` en claro (viola CA-10.2).

## R-09 Edición de proyectos (aclaración Q1)

- **Decision**: `PATCH /v1/projects/{projectId}` con `UpdateItem` condicionado
  `status = BORRADOR`; fallo de condición → 409. Nueva ruta `GET /v1/manage/projects` para que el
  GESTOR vea borradores (el catálogo público solo devuelve PUBLICADO).

## R-10 Donación por identificador (T09)

- **Decision**: añadir `GET /v1/donations/{donationId}`; si `donorSub ≠ sub` → 404 (no revela
  existencia) + AuditEvent de denegación.
- **Rationale**: `design.md` solo define `/me`; T09 necesita una ruta por recurso para probar BOLA.

## R-11 Esquemas compartidos

- **Decision**: npm workspaces `shared/`, `backend/`, `frontend/`. `shared` exporta esquemas Zod
  (`CreateDonationBody`, `CreateProjectBody`, `UpdateProjectBody`, `ApiError`) y tipos inferidos.
- **Rationale**: design.md §2 (Zod reutilizado en backend) con un único origen de verdad.

## R-12 Pruebas

- **Decision**:
  - Unitarias backend (Vitest + `aws-sdk-client-mock`): validación, authz, idempotencia, transiciones.
  - UI (Vitest + Testing Library + jsdom): formularios, estados vacío/error, aviso de simulación.
  - API contra stage `academic` (Bruno CLI, colección en `tests/api/`): T01–T07, T09, T11, T12.
  - Concurrencia T08: script Vitest de integración con `Promise.all` de 10 solicitudes.
  - Evidencia manual documentada: T10 (IAM Policy Simulator), T13 (token revocado), T14 (login
    GESTOR sin TOTP).
- **Rationale**: principio VI; cada test etiquetado con `T##` y CA/HU.

## R-13 TypeScript

- **Decision**: fijar la última versión de TypeScript que declaren compatible typescript-eslint y
  Vitest al hacer el scaffold; registrar la versión exacta en `package-lock.json` y en README.
- **Rationale**: design.md §2 advierte posibles incompatibilidades con TS 7.0.x.
