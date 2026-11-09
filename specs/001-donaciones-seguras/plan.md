# Implementation Plan: Plataforma de Donaciones Seguras — Fundación AQP-SOLIDARIA

**Branch**: `001-donaciones-seguras` | **Date**: 2026-11-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-donaciones-seguras/spec.md`

## Summary

SPA React estática (S3 privado + CloudFront OAC) y API serverless (API Gateway HTTP API + Lambda
Node.js 24 + DynamoDB) para catálogo de proyectos, intenciones de donación simuladas con
idempotencia atómica, gestión de proyectos y auditoría. Zero Trust según `design.md` §6:
Cognito = PA, JWT authorizer con scopes = PEP, módulo `authz` en Lambda (o Verified Permissions en
HU-12) = PE, IAM mínimo por función. IaC en AWS SAM, stage `academic`, región `us-east-2`.

## Technical Context

**Language/Version**: TypeScript (versión exacta fijada en scaffold, research R-13); Node.js 24
(`nodejs24.x`).

**Primary Dependencies**: Frontend: React 19, Vite 8, Tailwind CSS 4, React Router, React Hook
Form + Zod, TanStack Query, oidc-client-ts. Backend: AWS SDK v3 (`@aws-sdk/client-dynamodb`,
`@aws-sdk/lib-dynamodb`), Zod. Compartido: workspace `shared/` con esquemas Zod. Extensión:
`@aws-sdk/client-verifiedpermissions` + políticas Cedar.

**Storage**: DynamoDB on-demand: `Projects`, `Donations`, `Idempotency` (TTL), `AuditEvents`
([data-model.md](data-model.md)).

**Testing**: Vitest + `aws-sdk-client-mock` (backend), Vitest + Testing Library (UI), Bruno CLI
(API contra stage), script Vitest de concurrencia (T08); evidencias manuales T10, T13, T14.

**Target Platform**: AWS `us-east-2` (Free plan); navegadores modernos móviles y escritorio.

**Project Type**: Web application (SPA + API serverless) en monorepo npm workspaces.

**Performance Goals**: p95 ≤ 1.5 s en GET con 50 proyectos, sin cold start (RNF-HU-05).

**Constraints**: access token ≤ 15 min; tokens solo en memoria; throttling 20 rps / ráfaga 40;
logs ≤ 14 días; sin Lambda@Edge; sin secretos ni datos reales; sin Bootstrap; una región.

**Scale/Scope**: laboratorio académico, 4 roles de prueba, ~50 proyectos, 1 semana, 4–5 personas.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento en el plan | Estado |
|---|---|---|
| I. Zero Trust | JWT authorizer (emisor, firma, exp, `client_id`) + `AuthorizationScopes` por ruta; `authz` valida grupo y propietario en cada Lambda | ✅ |
| II. Backend autoritativo | `sub`/`cognito:groups` solo de `requestContext.authorizer.jwt.claims`; `amountCents` entero Zod | ✅ |
| III. Sin datos de pago | Esquemas Zod `strict()` rechazan campos extra; ningún campo de pago en contrato | ✅ |
| IV. Mínimo privilegio | 6 funciones de API + `PreAuthFn`, rol propio cada una, acciones y ARN de tabla/índice explícitos (R-05); CI sin llaves | ✅ |
| V. Integridad | `TransactWriteItems` condicionado en creación y simulación (R-07, data-model) | ✅ |
| VI. Pruebas primero | Tests de seguridad antes del handler; T01–T14 mapeados (R-12); CI lint/typecheck/test/build | ✅ |
| VII. Plataforma | Free plan, `us-east-2`, SAM, tokens en memoria, Tailwind | ✅ |
| VIII. Trazabilidad | Cada test/tarea con HU/CA/RNF-HU y `T##` | ✅ |

**MFA (R-02)**: user pool `OPTIONAL` + trigger Pre authentication que bloquea a GESTOR/AUDITOR
sin TOTP; DONANTE con MFA opcional según la matriz. Excepción IAM justificada: `PreAuthFn` usa
`userpool/*` de la cuenta y región (dependencia circular), documentada en `design.md`.

**Re-check post-diseño (Fase 1)**: ✅ sin violaciones. Rutas añadidas respecto a `design.md` §4
(`PATCH /v1/projects/{id}`, `GET /v1/manage/projects`, `GET /v1/donations/{id}`) mantienen scope +
grupo + propietario y quedan en [contracts/openapi.yaml](contracts/openapi.yaml).

## Project Structure

### Documentation (this feature)

```text
specs/001-donaciones-seguras/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/openapi.yaml
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
package.json                    # npm workspaces: shared, backend, frontend
shared/
└── src/schemas/                # Zod: project, donation, simulate, error
backend/
├── src/
│   ├── projects/               # handlers publicProjectsFn, manageProjectsFn
│   ├── donations/              # createDonationFn, simulateDonationFn, readDonationsFn
│   ├── authz/                  # claims → principal; RBAC + ownership; adaptador AVP (HU-12)
│   ├── audit/                  # record(), auditFn (HU-10)
│   ├── identity/               # preAuth.ts: trigger Cognito MFA obligatorio GESTOR/AUDITOR
│   └── shared/                 # http (errores uniformes), logger JSON, dynamo client, ids
└── test/
    ├── unit/                   # por módulo, etiquetados T##/CA-*
    └── integration/            # concurrency.test.ts (T08) contra stage
frontend/
├── src/
│   ├── auth/                   # oidc-client-ts, InMemoryWebStorage
│   ├── pages/                  # Catalog, ProjectDetail, Donate, Result, History, Manage, Audit
│   ├── components/
│   └── services/               # cliente API + TanStack Query
└── test/
infra/template.yaml             # SAM: Cognito, HTTP API, 6 Lambdas + PreAuthFn, 4 tablas, S3, CloudFront
policies/                       # Cedar (HU-12)
tests/api/                      # colección Bruno (T01–T07, T09, T11, T12)
docs/api.yaml                   # copia de contracts/openapi.yaml
docs/threat-model.md
evidence/
.github/workflows/ci.yml
```

**Structure Decision**: monorepo con tres workspaces (frontend, backend, shared) según
`design.md` §8, más `shared/` para reutilizar esquemas Zod (R-11). Infraestructura única en
`infra/template.yaml`.

## Complexity Tracking

Sin violaciones de la constitución que justificar.
