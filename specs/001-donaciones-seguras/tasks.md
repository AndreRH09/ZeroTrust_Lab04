---

description: "Task list — 001-donaciones-seguras"
---

# Tasks: Plataforma de Donaciones Seguras — Fundación AQP-SOLIDARIA

**Input**: `specs/001-donaciones-seguras/` — plan.md, spec.md, research.md, data-model.md,
contracts/openapi.yaml, quickstart.md; constitución v1.0.0.

**Tests**: OBLIGATORIOS (constitución principio VI). Cada prueba de seguridad se escribe **antes**
de su implementación y debe fallar sin el control.

**Organization**: por historia de usuario (US1…US12 = HU según spec.md), ordenadas por el plan de
7 días de `design.md` §9.

## Format: `[ID] [P?] [Story] (Día · Rol) Descripción — archivos → trazabilidad · prueba`

- **[P]**: paralelizable (archivo distinto, sin dependencias pendientes)
- **[USn]**: historia de usuario de spec.md
- **Día**: D1…D7 según `design.md` §9
- **Rol**: DevOps · IdSec (Identidad/Seguridad) · Backend · Frontend · QA (QA/Docs)
- Cada test lleva en su nombre `T##` y `CA-*` (principio VIII)
- Cada archivo de test empieza con `// @trace HU-xx, RNF-HU-xx, CA-..., T##` listando los CA de
  la tarea **y** sus HU/RNF-HU padre; T101 lee esas cabeceras

## Mapa de historias

| Story | HU | Prioridad | Día |
|---|---|---|---|
| US1 | HU-01 Listar proyectos | P1 MVP | D3 |
| US2 | HU-02 Consultar detalle | P1 MVP | D3 |
| US3 | HU-03 Iniciar/cerrar sesión | P1 MVP | D2 |
| US4 | HU-04 Control de roles | P1 MVP | D3–D4 |
| US5 | HU-11 MFA privilegiados | P1 MVP | D2, D5 |
| US6 | HU-05 Intención de donación | P1 MVP | D4 |
| US7 | HU-06 Simular confirmación | P1 MVP | D5 |
| US8 | HU-07 Historial propio | P2 MVP | D4 |
| US9 | HU-08 Gestionar proyectos | P1 MVP | D3 |
| US10 | HU-09 Indicadores agregados | P2 MVP | D3 |
| US11 | HU-10 Auditoría | P3 Extensión | D6 |
| US12 | HU-12 Autorización externalizada | P3 Extensión | D6 |

---

## Phase 1: Setup — D1 (Shared Infrastructure)

**Purpose**: monorepo, calidad, CI y cuenta segura. Entregable D1: CI en verde con proyecto vacío.

- [x] T001 (D1 · DevOps) Crear `package.json` raíz con npm workspaces `["shared","backend","frontend"]`, scripts `lint`, `typecheck`, `test`, `build`, `.nvmrc` = `24` y `tsconfig.base.json` (`strict: true`, `noUncheckedIndexedAccess: true`); fijar versión TypeScript compatible con typescript-eslint y Vitest (research R-13) → RNF-HU-08
- [x] T002 [P] (D1 · DevOps) Configurar ESLint 10 + typescript-eslint + Prettier 3 en `eslint.config.js` y `.prettierrc`; regla `no-restricted-imports` que prohíbe `bootstrap` → CA-NF08.1, principio VII
- [x] T003 [P] (D1 · Backend) Scaffold `shared/package.json`, `shared/tsconfig.json`, `shared/src/index.ts` con dependencia `zod@4` → research R-11
- [x] T004 [P] (D1 · Backend) Scaffold `backend/package.json`, `backend/tsconfig.json`, `backend/vitest.config.ts` con deps `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, devDeps `vitest`, `aws-sdk-client-mock` → RNF-HU-08
- [x] T005 [P] (D1 · Frontend) Scaffold Vite 8 + React 19 + TS en `frontend/` con Tailwind CSS 4 (`frontend/src/index.css` con `@import "tailwindcss"`), React Router, TanStack Query, React Hook Form, `oidc-client-ts`, Vitest + Testing Library + jsdom en `frontend/vite.config.ts` → principio VII
- [x] T006 (D1 · DevOps) Crear `.github/workflows/ci.yml`: Node 24, `npm ci`, lint, typecheck, test, build, `npm audit --audit-level=high`; sin credenciales AWS ni secretos → CA-NF08.1, CA-NF03.2
- [x] T007 [P] (D1 · DevOps) Crear `.github/dependabot.yml` (npm, semanal) y activar secret scanning en GitHub; documentar protección de `main` (1 revisión, CI requerido) en `README.md` §Contribución → CA-NF01.2
- [x] T008 [P] (D1 · IdSec) Crear `docs/threat-model.md` con STRIDE resumido, límites de confianza de `design.md` §3 y tabla NIST SP 800-207 (7 principios + PE/PA/PEP) → CA-NF02.3
- [x] T009 [P] (D1 · DevOps) Crear `docs/aws-account.md`: Free plan (`aws freetier get-account-plan-state`), región `us-east-2` confirmada en AWS Settings, alerta AWS Budgets, root con MFA sin uso, usuarios IAM por integrante con MFA y sin llaves → CA-NF09.1, CA-NF03.3
- [x] T010 [P] (D1 · QA) Crear `README.md` (esqueleto: despliegue, limpieza, restricciones), `AI_USAGE.md` (tabla de `design.md` §10) y `evidence/README.md` (reglas: tapar Account ID, tokens, correos) → RNF-HU-08, RNF-HU-10, CA-NF10.2

**Checkpoint D1**: CI en verde con workspaces vacíos; cuenta segura documentada.

---

## Phase 2: Foundational — D2 (Blocking Prerequisites)

**Purpose**: esquemas compartidos, `authz`, errores/logs, auditoría, IaC base y cliente OIDC.

**⚠️ CRITICAL**: ninguna historia empieza antes de este checkpoint.

### Tests primero (deben fallar)

- [x] T011 [P] (D2 · Backend) Test `shared/test/schemas.test.ts`: `amountCents` acepta 100 y 100000; rechaza 99, 100001, 0, -1, 1.5, `"100"`, `null`; `CreateDonation` y `CreateProject` son `strict()` y rechazan campos extra (`cardNumber`, `cvv`, `dni`, `donorSub`) → CA-05.2, CA-05.3, CA-05.5 · T04
- [x] T012 [P] (D2 · IdSec) Test `backend/test/unit/authz/principal.test.ts`: principal se deriva solo de `event.requestContext.authorizer.jwt.claims` (`sub`, `cognito:groups` en formato `"[DONANTE GESTOR]"` o array); ignora `sub`/`groups`/`role` del body, query y headers; sin claims → 401 → CA-04.3, CA-NF02.2 · T02
- [x] T013 [P] (D2 · IdSec) Test `backend/test/unit/authz/policy.test.ts`: matriz completa acción × rol (`projects:create|update|publish|listManage`, `donations:create|simulate|readOwn|readById`, `audit:read`) para VISITANTE/DONANTE/GESTOR/AUDITOR/sin grupo/multigrupo; ownership: `donorSub ≠ sub` → `NOT_FOUND`; toda denegación invoca `audit.record(AUTHZ_DENIED)` → CA-04.1, CA-04.2, CA-07.2 · T03, T09, T12
- [x] T014 [P] (D2 · Backend) Test `backend/test/unit/shared/http.test.ts`: errores uniformes `{ code, message, requestId }` sin stack; `logger` emite JSON con `requestId`, `action`, `outcome`, `statusCode`, `durationMs` y redacta `authorization`, `*token*`, `sub`, `idempotencyKey` → CA-NF01.2, CA-NF07.1
- [x] T015 [P] (D2 · Backend) Test `backend/test/unit/audit/record.test.ts`: `actorRef = HMAC-SHA256(sub, STACK_ID)` estable y ≠ `sub`; evento sin tokens, importes ni claves; `eventType` ∈ {`PROJECT_CREATED`,`PROJECT_UPDATED`,`PROJECT_PUBLISHED`,`DONATION_CREATED`,`DONATION_CONFIRMED`,`DONATION_REJECTED`,`AUTHZ_DENIED`}; `sk = timestamp#eventId` → CA-08.3, CA-10.2
- [x] T016 [P] (D2 · IdSec) Test estático `infra/test/template.test.ts` (Vitest + `yaml` con tags CFN tolerantes) sobre `infra/template.yaml`: `MfaConfiguration: OPTIONAL`, solo `SOFTWARE_TOKEN_MFA`, sin `SmsConfiguration`; `LambdaConfig.PreAuthentication` apunta a `PreAuthFn`; app client SPA sin secreto, solo `code`, sin `ALLOW_USER_PASSWORD_AUTH` ni scope `aws.cognito.signin.user.admin`, `AccessTokenValidity` ≤ 15 min, `EnableTokenRevocation: true`; cada ruta protegida con `AuthorizationScopes`; throttling 20/40; `RetentionInDays: 14`; ninguna policy con `Action: "*"` o `Resource: "*"` (única excepción permitida: `userpool/*` en el rol de `PreAuthFn`, R-02); ruta simulate con `Condition: IsAcademic` → RNF-HU-02, RNF-HU-03, CA-03.1, CA-03.3, CA-11.1, CA-06.1, CA-NF02.1, CA-NF03.1, CA-NF03.2, CA-NF07.1 · T10, T14
- [x] T017 [P] (D2 · Frontend) Test `frontend/test/auth.test.ts`: `UserManager` usa `InMemoryWebStorage` para `userStore`; tras login `localStorage`/`sessionStorage` no contienen tokens; logout llama `revokeTokens(["refresh_token"])` y limpia memoria → CA-03.3, CA-NF11.1
- [x] T018 [P] (D2 · IdSec) Test `backend/test/unit/identity/preAuth.test.ts` (cliente Cognito mockeado): usuario en `GESTOR` o `AUDITOR` sin `SOFTWARE_TOKEN_MFA` en `UserMFASettingList` o con otro `PreferredMfaSetting` → lanza error (login denegado, sin tokens); privilegiado con TOTP preferido → permite; `DONANTE` sin MFA → permite; usuario sin grupos → permite → RNF-HU-02, CA-11.1, CA-11.2 · T14

### Implementación

- [x] T019 (D2 · Backend) Implementar `shared/src/schemas/donation.ts`, `project.ts`, `simulate.ts`, `error.ts`: `amountCents` int 100–100000; `title` 3–120 trim; `description` 10–2000; `goalAmountCents` int 100–100000000; `UpdateProject` parcial con ≥ 1 campo; `Simulate.outcome` ∈ {`CONFIRM`,`REJECT`}; todos `.strict()` (data-model.md) → hace pasar T011
- [x] T020 (D2 · IdSec) Implementar `backend/src/authz/principal.ts` (`getPrincipal(event)`) → hace pasar T012
- [x] T021 (D2 · IdSec) Implementar `backend/src/authz/policy.ts` con interfaz única `decide(principal, action, resource?)` (punto de reemplazo para HU-12) → hace pasar T013
- [x] T022 [P] (D2 · Backend) Implementar `backend/src/shared/http.ts` (respuestas/errores, mapeo `ZodError`→400, `TransactionCanceledException`→409) y `backend/src/shared/logger.ts` → hace pasar T014
- [x] T023 [P] (D2 · Backend) Implementar `backend/src/shared/dynamo.ts` (DocumentClient, nombres de tabla desde env) y `backend/src/shared/ids.ts` (`randomUUID`) → data-model.md
- [x] T024 (D2 · Backend) Implementar `backend/src/audit/record.ts` (`PutItem` en `AuditEvents`) → hace pasar T015
- [x] T025 (D2 · DevOps) Crear `infra/template.yaml`: `Parameters.Stage` (AllowedValues `academic`), `Conditions.IsAcademic`, `Globals.Function` (`nodejs24.x`, `arm64`, env `STACK_ID: !Ref AWS::StackId`), tablas `Projects` (GSI `status-createdAt`), `Donations` (GSI `donorSub-createdAt`), `Idempotency` (TTL `expiresAt`), `AuditEvents` (PK `eventType`, SK `sk`), todas `PAY_PER_REQUEST` → RNF-HU-04, CA-NF08.2
- [x] T026 (D2 · IdSec) Añadir a `infra/template.yaml` Cognito: UserPool (`MfaConfiguration: OPTIONAL`, `EnabledMfas: [SOFTWARE_TOKEN_MFA]`, política de contraseñas fuerte, `AdminCreateUserConfig.AllowAdminCreateUserOnly: true`, `UserPoolClient.PreventUserExistenceErrors: ENABLED`), app client `admin-cli` sin OAuth y solo `ALLOW_ADMIN_USER_PASSWORD_AUTH` (enrolamiento TOTP de privilegiados), grupos `DONANTE`/`GESTOR`/`AUDITOR`, resource server `api` con scopes `projects.write`, `donations.write`, `donations.read`, `audit.read`, app client público (code + PKCE, access 15 min, refresh 60 min, rotación y revocación), dominio managed login → CA-03.1, CA-03.3, CA-11.1 · research R-02, R-03
- [x] T027 (D2 · IdSec) Implementar `backend/src/identity/preAuth.ts` (`AdminListGroupsForUser` + `AdminGetUser`) y añadir `PreAuthFn` a `infra/template.yaml` como `LambdaConfig.PreAuthentication` con rol propio limitado a `cognito-idp:AdminGetUser` y `cognito-idp:AdminListGroupsForUser` sobre `arn:aws:cognito-idp:${AWS::Region}:${AWS::AccountId}:userpool/*`; documentar esa excepción (dependencia circular pool→trigger) en `design.md` §6.2 → hace pasar T018 · CA-11.2, CA-NF03.2 · T14
- [x] T028 (D2 · DevOps) Añadir a `infra/template.yaml` `AWS::Serverless::HttpApi` (stage `academic`) con JWT authorizer (`issuer` del pool, `audience` = client id), `DefaultRouteSettings` throttling 20/40, CORS solo para el origen de CloudFront y `http://localhost:5173`, access logs JSON a log group con retención 14 días → CA-NF02.1, CA-NF07.1, FR-029 → hace pasar T016
- [x] T029 (D2 · DevOps) Desplegar el stack base con `sam build && sam deploy --region us-east-2 --profile zerotrust-lab04` (credenciales temporales) y registrar outputs en `docs/aws-account.md` (sin Account ID) → CA-NF08.2, CA-NF09.1
- [x] T030 (D2 · IdSec) Documentar en `docs/test-users.md` la creación de usuarios ficticios por grupo (`aws cognito-idp admin-create-user`); para GESTOR/AUDITOR, enrolamiento TOTP con el client `admin-cli` **antes** de asignar grupo: `admin-initiate-auth` → `associate-software-token` → `verify-software-token` → `admin-set-user-mfa-preference` → `admin-add-user-to-group`; DONANTE sin MFA → CA-NF10.1, CA-11.1
- [x] T031 (D2 · Frontend) Implementar `frontend/src/auth/oidc.ts` y `frontend/src/auth/AuthProvider.tsx` (`oidc-client-ts`, `InMemoryWebStorage`, scopes `openid email api/*`) → hace pasar T017
- [x] T032 [P] (D2 · Frontend) Implementar `frontend/src/services/api.ts`: `fetch` con `Authorization: Bearer <access_token>`, generación de `Idempotency-Key` (`crypto.randomUUID`), mapeo 401→re-login, 403/404→mensaje genérico, 429→"reintente en unos segundos" → CA-03.2, FR-029
- [x] T033 [P] (D2 · Frontend) Implementar `frontend/src/App.tsx` y `frontend/src/components/Layout.tsx`: router, banner "Prototipo académico — sin pagos reales" (CA-NF10.2), skip-link, foco visible, contenedor responsive 375 px → RNF-HU-06

**Checkpoint D2**: stack base desplegado; `authz`, esquemas, logs y auditoría probados.

---

## Phase 3: User Story 3 — HU-03 Iniciar y cerrar sesión (P1) — D2 🎯 MVP

**Goal**: identidad verificable con PKCE; rechazo de credenciales inválidas.

**Independent Test**: login PKCE + llamadas con credencial ausente, alterada o ID token (T02, T11).

### Tests (primero)

- [x] T034 [P] [US3] (D2 · QA) Crear colección Bruno `tests/api/bruno.json`, `tests/api/environments/academic.bru` (variables desde `process.env`, sin tokens en repo) y `tests/api/auth/T02-sin-token.bru` (`POST /v1/donations` sin `Authorization` → 401) → CA-03.2 · T02
- [x] T035 [P] [US3] (D2 · QA) Crear `tests/api/auth/T11-id-token.bru` (Bearer = ID token → 401), `tests/api/auth/T11-token-alterado.bru` (firma modificada → 401) y `tests/api/auth/T11-token-expirado.bru` → CA-03.2, CA-NF02.1 · T11

### Implementación

- [x] T036 [US3] (D2 · Frontend) Implementar `frontend/src/pages/Login.tsx`, `frontend/src/pages/Callback.tsx` y botón de logout en `frontend/src/components/Layout.tsx` (`signoutRedirect` + revocación) → CA-03.1, CA-03.3
- [ ] T037 [US3] (D2 · QA) Ejecutar T02/T11 contra `academic` y guardar evidencia sanitizada en `evidence/T02-T11-auth.md` → CA-03.2 · T02, T11

**Checkpoint**: login PKCE funcionando; T02 y T11 verdes.

---

## Phase 4: User Story 1 — HU-01 Listar proyectos (P1) — D3

**Goal**: catálogo público solo con PUBLICADO.

**Independent Test**: con borradores y publicados cargados, el visitante solo ve publicados (T01).

### Tests (primero)

- [x] T038 [P] [US1] (D3 · Backend) Test `backend/test/unit/projects/publicProjects.list.test.ts`: `Query` GSI `status-createdAt` con `status = PUBLICADO`; nunca devuelve BORRADOR; lista vacía → `{ items: [] }` 200 → CA-01.1, CA-01.2, CA-01.3 · T01
- [x] T039 [P] [US1] (D3 · Frontend) Test `frontend/test/Catalog.test.tsx`: muestra nombre, finalidad, meta y confirmado en PEN; estado vacío comprensible; error de red sin detalles técnicos → CA-01.1, CA-01.3, CA-NF06.2
- [x] T040 [P] [US1] (D3 · QA) Crear `tests/api/projects/T01-catalogo.bru` (200, ningún `status` ≠ PUBLICADO) → CA-01.1, CA-01.2 · T01

### Implementación

- [x] T041 [US1] (D3 · Backend) Implementar `GET /v1/projects` en `backend/src/projects/publicProjects.ts` → CA-01.1, CA-01.2
- [x] T042 [US1] (D3 · DevOps) Añadir `PublicProjectsFn` a `infra/template.yaml` con rol propio: solo `dynamodb:GetItem` en `Projects` y `dynamodb:Query` en `Projects/index/status-createdAt`; rutas públicas sin authorizer → CA-NF03.1 · T10
- [x] T043 [US1] (D3 · Frontend) Implementar `frontend/src/pages/Catalog.tsx` (TanStack Query, `Intl.NumberFormat('es-PE',{style:'currency',currency:'PEN'})` sobre céntimos/100 solo para mostrar) → CA-01.1, CA-01.3, CA-NF06.1

---

## Phase 5: User Story 2 — HU-02 Consultar detalle (P1) — D3

**Goal**: detalle de un proyecto publicado sin datos de donantes.

**Independent Test**: detalle de publicado (200) y de inexistente/borrador (404).

### Tests (primero)

- [x] T044 [P] [US2] (D3 · Backend) Test `backend/test/unit/projects/publicProjects.detail.test.ts`: PUBLICADO → 200 con `projectId`, `description`, `goalAmountCents`, `status`, `confirmedAmountCents` y sin `createdByRef`; BORRADOR o inexistente → 404 idéntico → CA-02.1, CA-02.2
- [x] T045 [P] [US2] (D3 · QA) Crear `tests/api/projects/detalle-404.bru` (UUID inexistente y BORRADOR → 404 mismo cuerpo) → CA-02.2

### Implementación

- [x] T046 [US2] (D3 · Backend) Implementar `GET /v1/projects/{projectId}` en `backend/src/projects/publicProjects.ts` y ruta en `infra/template.yaml` → CA-02.1, CA-02.2
- [x] T047 [P] [US2] (D3 · Frontend) Implementar `frontend/src/pages/ProjectDetail.tsx` con barra de progreso accesible (`role="progressbar"`) y botón "Donar" que exige sesión → CA-02.1, CA-NF06.2

---

## Phase 6: User Story 9 — HU-08 Gestionar proyectos (P1) — D3

**Goal**: GESTOR crea, edita (solo BORRADOR) y publica proyectos con auditoría.

**Independent Test**: crear → editar → publicar → editar otra vez (409); DONANTE crea (403, T03).

### Tests (primero)

- [x] T048 [P] [US9] (D3 · Backend) Test `backend/test/unit/projects/manageProjects.test.ts`: crear → `status = BORRADOR`; objetivo no positivo → 400; editar BORRADOR → 200; editar PUBLICADO → 409 (condición `status = BORRADOR`); publicar BORRADOR → 200; republicar → 409; DONANTE/AUDITOR/sin grupo → 403 + `AUTHZ_DENIED`; cada éxito registra `PROJECT_CREATED|UPDATED|PUBLISHED` → CA-08.1, CA-08.2, CA-08.3, CA-04.1 · T03
- [x] T049 [P] [US9] (D3 · QA) Crear `tests/api/projects/gestor-flujo.bru` (crear, editar, publicar, editar publicado 409, republicar 409) → CA-08.1, CA-08.2

### Implementación

- [x] T050 [US9] (D3 · Backend) Implementar `backend/src/projects/manageProjects.ts`: `GET /v1/manage/projects`, `POST /v1/projects`, `PATCH /v1/projects/{projectId}`, `PATCH /v1/projects/{projectId}/publish`, todos con `authz.decide` y `audit.record` → CA-08.1–3
- [x] T051 [US9] (D3 · DevOps) Añadir `ManageProjectsFn` a `infra/template.yaml`: rutas con `AuthorizationScopes: [api/projects.write]`; rol con `GetItem/PutItem/UpdateItem` en `Projects`, `Query` en su GSI, `PutItem` en `AuditEvents` → CA-NF02.1, CA-NF03.1
- [x] T052 [US9] (D3 · Frontend) Implementar `frontend/src/pages/Manage.tsx` (lista, formulario RHF + `CreateProject`/`UpdateProject` de `shared`, edición deshabilitada si PUBLICADO, publicar con confirmación); la UI no es control de acceso → CA-08.1, CA-08.2, CA-NF06.2

---

## Phase 7: User Story 10 — HU-09 Indicadores agregados (P2) — D3

**Goal**: totales públicos solo confirmados, sin datos individuales.

**Independent Test**: con donaciones en 3 estados, el total solo suma confirmadas.

### Tests (primero)

- [x] T053 [P] [US10] (D3 · Backend) Test `backend/test/unit/projects/publicProjects.stats.test.ts`: devuelve `goalAmountCents`, `confirmedAmountCents`, `progressPercent` entero (puede > 100); sin `donorSub` ni registros; BORRADOR → 404 → CA-09.1, CA-09.2
- [x] T054 [P] [US10] (D3 · Frontend) Test `frontend/test/money.test.ts`: `formatPEN(2500) === "S/ 25.00"`; progreso > 100% se muestra → CA-09.1

### Implementación

- [x] T055 [US10] (D3 · Backend) Implementar `GET /v1/projects/{projectId}/stats` en `backend/src/projects/publicProjects.ts` y ruta en `infra/template.yaml` → CA-09.1, CA-09.2
- [x] T056 [P] [US10] (D3 · Frontend) Implementar `frontend/src/lib/money.ts` (`formatPEN`, `parsePENToCents` por cadena, sin `float`) y usarlo en `Catalog.tsx`/`ProjectDetail.tsx` → CA-09.1, principio II

**Checkpoint D3 (hito de control)**: demo de login + catálogo + gestión; T01 y T03 verdes.

---

## Phase 8: User Story 6 — HU-05 Registrar intención de donación (P1) — D4

**Goal**: donación PENDIENTE_SIMULACION idempotente y atómica.

**Independent Test**: T04 (inválidos), T05 (válida), T06 (repetición), T07 (clave con otra carga).

### Tests (primero)

- [x] T057 [P] [US6] (D4 · Backend) Test `backend/test/unit/donations/createDonation.test.ts`: válida → 201 `PENDIENTE_SIMULACION`, `donorSub` = claim aunque el body traiga otro; sin `Idempotency-Key` o no UUID → 400; proyecto inexistente → 404; no PUBLICADO → 409 (`ConditionCheck`); usa un único `TransactWriteItems` [Put Idempotency `attribute_not_exists(pk)`, ConditionCheck Project, Put Donation]; no-DONANTE → 403 → CA-05.1, CA-05.2, CA-05.3 · T04, T05
- [x] T058 [P] [US6] (D4 · Backend) Test `backend/test/unit/donations/idempotency.test.ts`: `payloadHash` SHA-256 de `{projectId, amountCents}` canónico; misma clave + mismo hash → misma respuesta almacenada y 0 escrituras nuevas; hash distinto → 409; `expiresAt = now + 86400`; registro expirado ignorado; misma clave de otro donante no colisiona; `TransactionCanceledException` → relectura → CA-05.4 · T06, T07
- [x] T059 [P] [US6] (D4 · QA) Crear `tests/api/donations/T04-montos-invalidos.bru` (0, 100001, 1.5, `"100"`), `T05-donacion-valida.bru`, `T06-repeticion.bru`, `T07-clave-otra-carga.bru` → CA-05.1, CA-05.2, CA-05.4 · T04–T07
- [x] T060 [P] [US6] (D4 · Frontend) Test `frontend/test/Donate.test.tsx`: no existen campos de tarjeta/CVV/cuenta/DNI; "10.555" y "0" muestran error accesible; "25" envía `amountCents: 2500` → CA-05.5, CA-05.2, CA-NF06.2

### Implementación

- [x] T061 [US6] (D4 · Backend) Implementar `backend/src/donations/idempotency.ts` → hace pasar T058
- [x] T062 [US6] (D4 · Backend) Implementar `POST /v1/donations` en `backend/src/donations/createDonation.ts` con `audit.record(DONATION_CREATED)` → hace pasar T057
- [x] T063 [US6] (D4 · DevOps) Añadir `CreateDonationFn` a `infra/template.yaml`: `AuthorizationScopes: [api/donations.write]`; rol con `GetItem`/`ConditionCheckItem` en `Projects`, `PutItem` en `Donations`, `GetItem`/`PutItem` en `Idempotency`, `PutItem` en `AuditEvents` → CA-NF03.1
- [x] T064 [US6] (D4 · Frontend) Implementar `frontend/src/pages/Donate.tsx` (RHF + `CreateDonation`, conversión con `parsePENToCents`, `Idempotency-Key` reutilizada en reintentos del mismo envío) → CA-05.1, CA-05.5

---

## Phase 9: User Story 8 — HU-07 Ver historial propio (P2) — D4

**Goal**: el donante solo ve sus donaciones; BOLA bloqueado.

**Independent Test**: historial propio (200) y donación ajena (404, T09).

### Tests (primero)

- [x] T065 [P] [US8] (D4 · Backend) Test `backend/test/unit/donations/readDonations.test.ts`: `/me` consulta GSI `donorSub-createdAt` solo con `sub` del token; `GET /{id}` ajeno → 404 idéntico a inexistente + `AUTHZ_DENIED`; GESTOR → 403 → CA-07.1, CA-07.2, CA-04.2 · T09, T12
- [x] T066 [P] [US8] (D4 · QA) Crear `tests/api/donations/T09-donacion-ajena.bru` (token DONANTE B sobre donación de A → 404 sin datos) → CA-07.2 · T09

### Implementación

- [x] T067 [US8] (D4 · Backend) Implementar `GET /v1/donations/me` y `GET /v1/donations/{donationId}` en `backend/src/donations/readDonations.ts` → CA-07.1, CA-07.2
- [x] T068 [US8] (D4 · DevOps) Añadir `ReadDonationsFn` a `infra/template.yaml`: `AuthorizationScopes: [api/donations.read]`; rol con `GetItem` en `Donations`, `Query` en `Donations/index/donorSub-createdAt`, `PutItem` en `AuditEvents` → CA-NF03.1
- [x] T069 [P] [US8] (D4 · Frontend) Implementar `frontend/src/pages/History.tsx` (fecha, importe PEN, proyecto, estado; estado vacío) → CA-07.1, CA-NF06.1

---

## Phase 10: User Story 4 — HU-04 Control de roles (P1) — D3–D4

**Goal**: demostrar que la autorización vive en el backend (llamadas directas con tokens de otros roles).

**Independent Test**: T03 y T12 contra el stage con tokens reales.

### Tests (primero)

- [x] T070 [P] [US4] (D3 · QA) Crear `tests/api/authz/T03-donante-crea-proyecto.bru` (token DONANTE → `POST /v1/projects` 403, `PATCH .../publish` 403) → CA-04.1 · T03
- [x] T071 [P] [US4] (D4 · QA) Crear `tests/api/authz/T12-gestor-historial.bru` (token GESTOR → `GET /v1/donations/me` 403 y `GET /v1/donations/{id}` 403/404) → CA-04.2 · T12
- [x] T072 [P] [US4] (D4 · QA) Crear `tests/api/authz/body-spoofing.bru` (body con `donorSub`, `groups`, `role` ajenos → 400 por `strict()` o ignorados) → CA-04.3, CA-NF02.2

### Implementación

- [x] T073 [US4] (D4 · IdSec) Revisar que todos los handlers (`manageProjects.ts`, `createDonation.ts`, `readDonations.ts`) llaman `authz.decide` antes de cualquier lectura de negocio y registran `AUTHZ_DENIED`; documentar en `docs/threat-model.md` §Autorización → CA-04.1–3
- [ ] T074 [US4] (D4 · QA) Ejecutar T03/T12 y guardar `evidence/T03-T12-authz.md` (incluye prueba de que ocultar botones no es el control) → CA-04.1, CA-04.2 · T03, T12

**Checkpoint D4**: T04–T07, T09, T12 verdes.

---

## Phase 11: User Story 7 — HU-06 Simular confirmación (P1) — D5

**Goal**: transición única y atómica; solo en stage `academic`.

**Independent Test**: confirmar propia; 10 confirmaciones concurrentes = 1 incremento (T08).

### Tests (primero)

- [x] T075 [P] [US7] (D5 · Backend) Test `backend/test/unit/donations/simulateDonation.test.ts`: `CONFIRM` → `CONFIRMADA_SIMULADA` + `ADD confirmedAmountCents :amount` en el mismo `TransactWriteItems` con condición `status = PENDIENTE_SIMULACION AND donorSub = :sub`; `REJECT` → `RECHAZADA_SIMULADA` sin tocar Project; estado terminal → 409; ajena → 404 + `AUTHZ_DENIED`; registra `DONATION_CONFIRMED|REJECTED` → CA-06.1, CA-06.2, CA-06.3, CA-NF04.2 · T08
- [x] T076 [P] [US7] (D5 · QA) Test `backend/test/integration/concurrency.test.ts` (script `test:concurrency`, solo contra `academic` con env `API_URL` y `DONOR_TOKEN`): crea donación y lanza 10 `simulate CONFIRM` con `Promise.all`; espera exactamente 1×200, 9×409 y un único incremento en `/stats` → CA-06.2, CA-NF04.1 · T08
- [x] T077 [P] [US7] (D5 · Frontend) Test `frontend/test/Result.test.tsx`: muestra literal «Simulación académica: no se ha realizado ningún cobro» tras confirmar o rechazar → CA-06.4

### Implementación

- [x] T078 [US7] (D5 · Backend) Implementar `POST /v1/donations/{donationId}/simulate` en `backend/src/donations/simulateDonation.ts` → hace pasar T075
- [x] T079 [US7] (D5 · DevOps) Añadir `SimulateDonationFn` a `infra/template.yaml` con `Condition: IsAcademic`, `AuthorizationScopes: [api/donations.write]`; rol con `GetItem`/`UpdateItem` en `Donations`, `UpdateItem` en `Projects`, `PutItem` en `AuditEvents` → CA-06.1, CA-NF03.1
- [x] T080 [US7] (D5 · Frontend) Implementar `frontend/src/pages/Result.tsx` (botones Confirmar/Rechazar simulación, aviso CA-06.4, total actualizado) → CA-06.4, CA-NF06.1
- [ ] T081 [US7] (D5 · QA) Ejecutar T08 y guardar `evidence/T08-concurrencia.md`, incluyendo la decisión documentada de usar `TransactWriteItems` condicionado → CA-NF04.1, CA-NF04.2 · T08

---

## Phase 12: User Story 5 — HU-11 MFA para roles privilegiados (P1) — D5

**Goal**: GESTOR y AUDITOR no obtienen tokens sin TOTP.

**Independent Test**: login de GESTOR sin segundo factor falla (T14). Config verificada por T016.

- [x] T082 [US5] (D5 · IdSec) Ejecutar T14: (a) GESTOR de prueba sin TOTP → el trigger `PreAuthFn` deniega el login, sin tokens; (b) GESTOR enrolado completando solo contraseña en managed login → Cognito exige código, sin tokens; capturar pantalla sanitizada en `evidence/T14-mfa-gestor.md`; verificar con `aws cognito-idp admin-get-user` que GESTOR/AUDITOR tienen `SOFTWARE_TOKEN_MFA` → CA-11.1, CA-11.2 · T14
- [x] T083 [US5] (D5 · IdSec) Documentar en `docs/threat-model.md` la decisión MFA `OPTIONAL` + trigger Pre authentication (obligatorio GESTOR/AUDITOR, opcional DONANTE; research R-02), su límite (no corre en refresh) y las alternativas descartadas (`ON` para todos, dos pools) → CA-11.1, CA-11.2

## Phase 12b: HU-03 limitación de revocación — D5

- [x] T084 [US3] (D5 · IdSec) Ejecutar T13: revocar refresh token (`/oauth2/revoke`), reusar access token antes (aceptado) y después de su expiración (401); documentar ventana ≤ 15 min en `evidence/T13-revocacion.md` → CA-03.4 · T13

**Checkpoint D5**: T08, T13, T14 verdes.

---

## Phase 13: User Story 11 — HU-10 Consultar auditoría (P3, Extensión) — D6

**Goal**: AUDITOR filtra eventos por tipo y fecha.

**Independent Test**: AUDITOR obtiene eventos; DONANTE/GESTOR → 403.

- [x] T085 [P] [US11] (D6 · Backend) Test `backend/test/unit/audit/auditFn.test.ts`: `eventType` obligatorio, `from`/`to` ISO; `Query eventType = :t AND sk BETWEEN`; no AUDITOR → 403; respuesta sin `sub` ni tokens → CA-10.1, CA-10.2
- [x] T086 [US11] (D6 · Backend) Implementar `GET /v1/audit` en `backend/src/audit/auditFn.ts` → CA-10.1
- [x] T087 [US11] (D6 · DevOps) Añadir `AuditFn` a `infra/template.yaml`: `AuthorizationScopes: [api/audit.read]`; rol solo `dynamodb:Query` en `AuditEvents` → CA-NF03.1
- [x] T088 [P] [US11] (D6 · Frontend) Implementar `frontend/src/pages/Audit.tsx` (filtros tipo/fecha accesibles) → CA-10.1, CA-NF06.2

---

## Phase 14: User Story 12 — HU-12 Autorización externalizada (P3, Extensión) — D6

**Goal**: mismas decisiones de HU-04/07/08 con Verified Permissions + Cedar.

**Independent Test**: T03, T09, T12 pasan con `AUTHZ_ENGINE=avp`.

- [x] T089 [P] [US12] (D6 · IdSec) Escribir `policies/schema.cedarschema` y `policies/*.cedar` (permitir por grupo + `resource.donorSub == principal.sub`) → CA-12.1
- [x] T090 [P] [US12] (D6 · IdSec) Test `backend/test/unit/authz/avpPolicy.test.ts`: reutiliza la matriz de T013 contra el adaptador AVP (cliente mockeado con decisiones de las políticas) y exige resultados idénticos → CA-12.2 · T03, T09, T12
- [x] T091 [US12] (D6 · IdSec) Implementar `backend/src/authz/avpPolicy.ts` (`IsAuthorized`) y selector `AUTHZ_ENGINE` (`embedded`|`avp`) en `backend/src/authz/policy.ts` → CA-12.1
- [x] T092 [US12] (D6 · DevOps) Añadir a `infra/template.yaml` `AWS::VerifiedPermissions::PolicyStore` + políticas y permiso `verifiedpermissions:IsAuthorized` sobre ese store para las funciones protegidas → CA-12.1, CA-NF03.2
- [ ] T093 [US12] (D6 · QA) Ejecutar T03/T09/T12 con `AUTHZ_ENGINE=avp` y comparar embebido vs externo en `evidence/HU-12-comparacion.md` → CA-12.2

---

## Phase 15: Polish & Cross-Cutting — D5–D7

- [x] T094 (D5 · DevOps) Añadir a `infra/template.yaml` bucket S3 privado (Block Public Access, cifrado), CloudFront con OAC, `ResponseHeadersPolicy` (CSP `default-src 'self'; connect-src` API + dominio Cognito; `frame-ancestors 'none'`; HSTS 1 año; `X-Content-Type-Options: nosniff`; `Referrer-Policy: strict-origin-when-cross-origin`), `ViewerProtocolPolicy: redirect-to-https`, sin Lambda@Edge → RNF-HU-01, RNF-HU-11, CA-NF01.1, CA-NF11.2
- [x] T095 (D5 · DevOps) Script `npm run deploy:web` en `package.json` raíz (`vite build` + `aws s3 sync --delete` + invalidación) y añadir callback/logout URL de CloudFront al app client → CA-NF01.1
- [x] T096 [P] (D5 · QA) Verificar cabeceras con `curl -I` y guardar `evidence/CA-NF11-cabeceras.md` → CA-NF11.2
- [x] T097 [P] (D6 · IdSec) Ejecutar T10 en IAM Policy Simulator (rol `PublicProjectsFn` + `dynamodb:PutItem`/`UpdateItem` → `implicitDeny`) y revisar todos los roles con IAM Access Analyzer; guardar `evidence/T10-minimo-privilegio.md` → CA-NF03.1, CA-NF03.2 · T10
- [ ] T098 [P] (D6 · QA) Script `backend/test/perf/seed-and-measure.ts`: cargar 50 proyectos ficticios y medir p95 de GET (excluir primera llamada); registrar método, herramienta y condiciones en `evidence/RNF-HU-05-rendimiento.md` → CA-NF05.1, CA-NF05.2
- [ ] T099 [P] (D6 · Frontend) Auditoría de accesibilidad (axe/Lighthouse, teclado, 375 px) en Catalog, ProjectDetail, Donate, Result; corregir y documentar criterios WCAG 2.2 AA en `evidence/RNF-HU-06-accesibilidad.md` → CA-NF06.1, CA-NF06.2
- [x] T100 [P] (D6 · QA) Capturar en CloudWatch Logs Insights un 2xx y un 401/403 por `requestId` (sin tokens ni `sub`) y un evento CloudTrail de cambio de infraestructura en `evidence/RNF-HU-07-observabilidad.md` → CA-NF07.1, CA-NF07.2
- [x] T101 [P] (D6 · QA) Script `scripts/check-traceability.mjs` + paso en `.github/workflows/ci.yml`: extrae los IDs de las cabeceras `// @trace` (y `docs: @trace` en `.bru`) de `backend/test`, `frontend/test`, `shared/test`, `infra/test` y `tests/api`; falla si algún ID HU/CA/RNF-HU del MVP de `requirements.md` no aparece o si un archivo de test no tiene cabecera → principio VIII
- [x] T102 (D7 · QA) Copiar `specs/001-donaciones-seguras/contracts/openapi.yaml` a `docs/api.yaml` y validar que coincide con rutas de `infra/template.yaml` → RNF-HU-08
- [x] T103 (D7 · QA) Completar `README.md` (despliegue, usuarios de prueba, limpieza con `sam delete`, restricciones Free plan y región) y `AI_USAGE.md` → CA-NF08.2, CA-NF09.2
- [x] T104 [P] (D7 · IdSec) Completar `docs/threat-model.md` con tabla final NIST SP 800-207 y limitaciones (`design.md` §6.3) → CA-NF02.3
- [ ] T105 (D7 · QA) Ejecutar `quickstart.md` completo (escenarios 1–12) y la demo con los 4 roles → SC-001, SC-009
- [ ] T106 (D7 · DevOps) Ejecutar limpieza (vaciar bucket, `sam delete`, verificar Resource Explorer en `us-east-2` y logs en `us-east-1`) y registrar en `evidence/RNF-HU-09-limpieza.md` → CA-NF09.2

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (D1)** → **Foundational (D2)** → historias.
- **US3** depende de T026–T031 (Cognito + OIDC).
- **US1, US2, US10** comparten `backend/src/projects/publicProjects.ts` → secuenciales entre sí (T041 → T046 → T055).
- **US9** independiente de US1 (archivo propio); necesaria para crear proyectos de prueba de US6.
- **US6** depende de proyectos PUBLICADO (US9 o datos semilla).
- **US8** depende de US6 (necesita donaciones).
- **US4**: T070 tras US9; T071 tras US8.
- **US7** depende de US6; T076 necesita stack desplegado.
- **US5** depende de T026 y usuarios T030.
- **US11** depende de T024 (eventos existentes); **US12** depende de T021 y T013.
- **Polish**: T094–T096 desde D5; resto tras MVP.

### Within Each User Story

- Test(s) → implementación backend → IaC → frontend → evidencia.
- Las pruebas deben fallar antes de implementar (verificar en el PR).

### Parallel Opportunities

- D1: T002–T005, T007–T010.
- D2: tests T011–T018 en paralelo (5 roles); luego T022/T023, T032/T033.
- D3: US9 (Backend B) en paralelo con US1/US2/US10 (Backend A); Frontend en T043/T047/T052; QA en T040/T045/T049/T070.
- D4: tests T057–T060 en paralelo; US8 tests (T065/T066) en paralelo con implementación US6.
- D6: US11 y US12 en paralelo; T097–T101 en paralelo.

---

## Parallel Example: User Story 6 (D4)

```text
Backend:  T057 createDonation.test.ts   |  T058 idempotency.test.ts
QA:       T059 Bruno T04–T07
Frontend: T060 Donate.test.tsx
→ luego Backend T061 → T062, DevOps T063, Frontend T064
```

## Parallel Example: Foundational (D2)

```text
Backend: T011, T014, T015   IdSec: T012, T013, T016, T018   Frontend: T017
→ T019–T024 (Backend/IdSec), T025–T029 (DevOps/IdSec), T031–T033 (Frontend)
```

---

## Implementation Strategy

### MVP First

1. D1 Setup → D2 Foundational + US3 (login, T02/T11).
2. D3 US1 + US2 + US9 + US10 → **STOP y validar** (hito de control: login + catálogo + T01/T03).
3. D4 US6 + US8 + US4 → T04–T07, T09, T12.
4. D5 US7 + US5 + revocación + CloudFront → T08, T13, T14.

### Incremental Delivery

- Cada fase termina con evidencia en `evidence/` y PR revisado por otro integrante con CI verde.
- D6 endurecimiento (T10, rendimiento, accesibilidad, logs) y extensiones US11/US12 si hay tiempo.
- D7 documentación, demo y limpieza.

### Parallel Team Strategy (5 roles)

| Rol | Foco por día |
|---|---|
| DevOps | D1 CI/cuenta · D2 SAM base · D3–D5 funciones e IAM · D5 CloudFront · D7 limpieza |
| IdSec | D1 threat model · D2 authz + Cognito + test IaC · D4 revisión authz · D5 T13/T14 · D6 T10 + HU-12 |
| Backend | D2 esquemas/http/audit · D3 projects · D4 donations · D5 simulate · D6 HU-10 |
| Frontend | D2 OIDC/layout · D3 catálogo/detalle/gestión · D4 donar/historial · D5 resultado · D6 accesibilidad |
| QA/Docs | D1 README/AI_USAGE · D2–D5 colección Bruno + evidencias · D6 rendimiento/logs/trazabilidad · D7 informe |

Con 4 integrantes, QA/Docs se reparte entre todos (`design.md` §9).

---

## Notes

- Ningún test ni fixture contiene tokens, correos reales, Account IDs ni datos de pago.
- Cambios IAM o de scopes en `infra/template.yaml` exigen justificación en el PR (constitución).
- Commit por tarea o grupo lógico; mensajes con IDs (`feat(donations): T062 CA-05.1`).
