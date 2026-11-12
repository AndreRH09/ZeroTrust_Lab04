# Plataforma de Donaciones Seguras — Fundación AQP-SOLIDARIA

Prototipo académico (Tópicos Avanzados en Ingeniería de Software · EPIS-UNSA) de una plataforma
cloud-native serverless para publicar campañas y registrar **intenciones de donación simuladas**,
con modelo de seguridad **Zero Trust** (NIST SP 800-207).

> ⚠️ No procesa pagos reales. Está prohibido solicitar o almacenar tarjetas, CVV, cuentas bancarias o
> DNI. Usuarios y proyectos son ficticios.

Especificación: [requirements.md](requirements.md) · Diseño: [design.md](design.md) ·
Contrato: [docs/api.yaml](docs/api.yaml) · Amenazas y NIST: [docs/threat-model.md](docs/threat-model.md) ·
Cuenta AWS: [docs/aws-account.md](docs/aws-account.md) · Usuarios de prueba: [docs/test-users.md](docs/test-users.md)

## Arquitectura

```text
SPA React (S3 privado + CloudFront OAC, CSP/HSTS)  ──PKCE──►  Amazon Cognito (MFA TOTP, grupos)
        │ HTTPS + Bearer access token
        ▼
API Gateway HTTP API (JWT authorizer + scopes, 20 rps)  = PEP
        ▼
Lambda Node.js 24 (authz: rol + propietario)  = PE  ──(HU-12)──►  Verified Permissions (Cedar)
        ▼
DynamoDB: Projects · Donations · Idempotency (TTL) · AuditEvents
```

| Función | Rutas | Permisos DynamoDB |
|---|---|---|
| `PublicProjectsFn` | `GET /v1/projects`, `/{id}`, `/{id}/stats` (públicas) | Projects: GetItem, Query(GSI) |
| `ManageProjectsFn` | `GET /v1/manage/projects`, `POST /v1/projects`, `PATCH /{id}`, `PATCH /{id}/publish` | Projects: Get/Put/Update/Query; Audit: Put |
| `CreateDonationFn` | `POST /v1/donations` (`Idempotency-Key`) | Projects: Get/ConditionCheck; Donations: Put; Idempotency: Get/Put; Audit: Put |
| `SimulateDonationFn` | `POST /v1/donations/{id}/simulate` (solo stage `academic`) | Donations: Get/Update; Projects: Update; Audit: Put |
| `ReadDonationsFn` | `GET /v1/donations/me`, `GET /v1/donations/{id}` | Donations: Get, Query(GSI); Audit: Put |
| `AuditFn` (HU-10) | `GET /v1/audit` | Audit: Query, Put |
| `PreAuthFn` | Trigger Cognito Pre authentication | `cognito-idp:AdminGetUser`, `AdminListGroupsForUser` |

## Estructura

```text
shared/      Esquemas Zod compartidos (montos en céntimos, strict)
backend/     Lambdas TypeScript (src/{projects,donations,authz,audit,identity,shared}) + tests
frontend/    SPA React 19 + Vite 8 + Tailwind 4 + TanStack Query + oidc-client-ts
infra/       template.yaml (AWS SAM) + prueba estática de la plantilla
policies/    Políticas Cedar (HU-12)
tests/api/   Colección Bruno contra el stage academic
tests/manual Procedimientos manuales (T10, T13, T14, rendimiento, accesibilidad…)
scripts/     deploy-api.sh, deploy-web.sh, cleanup.sh, get-tokens.mjs, measure-perf.mjs, trazabilidad
evidence/    Evidencias sanitizadas
```

## Desarrollo local

Requisitos: Node.js 24 (`.nvmrc`; funciona con ≥ 22.12), npm 10.

```bash
npm ci
npm run lint && npm run format:check && npm run typecheck
npm test            # shared + backend + frontend + infra
npm run trace       # T01–T14 y todos los HU/CA/RNF-HU del MVP con prueba
npm run build       # Lambdas (backend/dist) + SPA (frontend/dist)
```

Frontend contra una pila desplegada: copiar `frontend/.env.example` a `frontend/.env.local` con los
outputs y ejecutar `npm run dev -w frontend` (http://localhost:5173, ya registrado en Cognito y CORS).

**Versiones:** TypeScript se fija en **6.0.3** porque typescript-eslint 8.72 solo soporta
`>=4.8.4 <6.1.0` (TS 7 aún no es compatible; research R-13). El resto, exacto en `package-lock.json`.

## Despliegue (AWS Free plan, `us-east-2`)

Antes: confirmar la región en *AWS Settings → View all projects → Overview → Additional Info →
Region*, `aws freetier get-account-plan-state` = `FREE`, alerta de AWS Budgets y credenciales
temporales (CloudShell o SSO; nunca llaves de larga duración). Requiere AWS CLI v2 y SAM CLI.

```bash
AWS_PROFILE=zerotrust-lab04 npm run deploy:api   # esbuild + sam deploy (la 1.ª vez hace 2 pasadas
                                                 # para registrar la URL de CloudFront en Cognito/CORS)
AWS_PROFILE=zerotrust-lab04 npm run deploy:web   # build de la SPA con los outputs + S3 + invalidación
```

Variables opcionales: `STACK` (por defecto `zerotrust-lab04`), `DOMAIN_PREFIX` (prefijo único del
dominio de Cognito), `ENABLE_AVP=true` (extensión HU-12).

Después crear los usuarios ficticios con [docs/test-users.md](docs/test-users.md).

## Pruebas

| ID | Escenario | Dónde |
|---|---|---|
| T01 | Visitante consulta proyectos | `publicProjects.test.ts`, `tests/api/2-projects/T01-catalogo.bru` |
| T02 | Sin token intenta donar → 401 | `principal.test.ts`, `createDonation.test.ts`, `1-auth/T02-sin-token.bru` |
| T03 | Donante crea proyecto → 403 | `policy.test.ts`, `manageProjects.test.ts`, `4-authz/T03-….bru` |
| T04 | Montos inválidos → 400 | `schemas.test.ts`, `createDonation.test.ts`, `Donate.test.tsx`, `3-donations/T04-….bru` |
| T05 | Intención válida → 201 | `createDonation.test.ts`, `3-donations/T05-….bru` |
| T06 | Misma clave y carga → mismo resultado | `createDonation.test.ts`, `3-donations/T06-….bru` |
| T07 | Misma clave, otra carga → 409 | `createDonation.test.ts`, `3-donations/T07-….bru` |
| T08 | 10 confirmaciones concurrentes → un incremento | `simulateDonation.test.ts`, `backend/test/integration/concurrency.test.ts` |
| T09 | Donación ajena → 404 | `readDonations.test.ts`, `3-donations/T09-….bru` |
| T10 | Lambda de listado no escribe | `infra/test/template.test.ts`, `tests/manual/T10-…md` |
| T11 | ID token o token alterado → 401 | `principal.test.ts`, `1-auth/T11-*.bru` |
| T12 | Gestor consulta historial → 403 | `readDonations.test.ts`, `4-authz/T12-….bru` |
| T13 | Token revocado antes de expirar | `tests/manual/T13-revocacion.md` |
| T14 | GESTOR sin TOTP no obtiene tokens | `preAuth.test.ts`, `tests/manual/T14-mfa-gestor.md` |

Contra el stage desplegado (tokens en variables de entorno, nunca en archivos):

```bash
export API_URL=… DONOR_TOKEN=… DONOR_B_TOKEN=… GESTOR_TOKEN=… ID_TOKEN=… PROJECT_ID=… DRAFT_PROJECT_ID=…
(cd tests/api && npx @usebruno/cli run --env academic)
npm run test:concurrency -w backend                 # T08
node scripts/measure-perf.mjs --seed                 # RNF-HU-05
```

## Limpieza (CA-NF09.2)

```bash
AWS_PROFILE=zerotrust-lab04 bash scripts/cleanup.sh   # vacía el bucket y ejecuta sam delete
```

Verificar en Resource Explorer (`us-east-2`) y en CloudWatch Logs de `us-east-1` que no queden
recursos. La pila `aws-sam-cli-managed-default` (bucket de artefactos de SAM) se elimina aparte si ya
no se usa.

## Restricciones de la cuenta

- AWS **Free plan**, una sola región (`us-east-2`); CloudFront es global.
- Sin Lambda@Edge, StackSets, recursos multirregión, MFA por SMS, Cognito Plus, WAF, Verified Access,
  GuardDuty ni Security Hub (limitaciones en [docs/threat-model.md](docs/threat-model.md)).
- Acceso humano como *team members* con MFA; nadie usa root.

## Contribución

- `main` protegida: PR con al menos una revisión de otro integrante y CI en verde.
- Ramas cortas; commits pequeños; nada de llaves, tokens ni datos reales (secret scanning activo).
- Uso de IA declarado en [AI_USAGE.md](AI_USAGE.md).
