# Quickstart — validación end-to-end de 001-donaciones-seguras

Guía para demostrar que la feature funciona. Contratos: [contracts/openapi.yaml](contracts/openapi.yaml).
Datos: [data-model.md](data-model.md). Decisiones: [research.md](research.md).

## Prerrequisitos

- Node.js 24, npm, AWS SAM CLI, Bruno CLI (`@usebruno/cli`), AWS CLI v2.
- Sesión AWS temporal: `aws login --profile zerotrust-lab04` (sin llaves de larga duración).
- Región `us-east-2` confirmada en AWS Settings > View all projects > Overview > Additional Info > Region.
- `aws freetier get-account-plan-state --profile zerotrust-lab04` → `accountPlanType: FREE`.
- Alerta de AWS Budgets creada (RNF-HU-09).

## 1. Calidad local (CI equivalente)

```powershell
npm ci
npm run lint; npm run typecheck; npm test; npm run build
```

Esperado: todo en verde; los tests de seguridad muestran sus etiquetas `T##` y `CA-*`.

## 2. Despliegue del stage `academic`

```bash
AWS_PROFILE=zerotrust-lab04 npm run deploy:api   # build de Lambdas + sam deploy (2 pasadas la 1.ª vez)
AWS_PROFILE=zerotrust-lab04 npm run deploy:web   # build de la SPA con los outputs + S3 + invalidación
```

Outputs: `ApiUrl`, `UserPoolId`, `SpaClientId`, `AdminCliClientId`, `CognitoDomainUrl`, `WebUrl`.

## 3. Usuarios de prueba (solo ficticios)

Crear 1 usuario por grupo (`DONANTE`, `GESTOR`, `AUDITOR`) con correo de prueba. GESTOR y AUDITOR
enrolan TOTP con el app client `admin-cli` **antes** de añadirlos a su grupo; el DONANTE no
necesita MFA (research R-02, `docs/test-users.md`). Exportar tokens de acceso de cada rol como
variables de entorno de Bruno (nunca commitear el archivo `.env` de Bruno).

## 4. Escenarios de validación

| # | Acción | Esperado | Trazabilidad |
|---|---|---|---|
| 1 | GESTOR crea proyecto, lo edita y lo publica; intenta editarlo otra vez | 201, 200, 200, 409 | HU-08, Q1 |
| 2 | Visitante abre el catálogo en móvil (375 px) | solo PUBLICADO; estado vacío si no hay | T01, CA-01.3, RNF-HU-06 |
| 3 | `bru run tests/api --env academic` | T01–T07, T09, T11, T12 verdes | ver colección |
| 4 | `npm run test:concurrency -w backend` (10 confirmaciones paralelas) | un solo incremento | T08 |
| 5 | DONANTE dona S/ 25.00 desde la UI y simula confirmación | aviso «Simulación académica: no se ha realizado ningún cobro»; total sube 2500 céntimos | HU-05, HU-06 |
| 6 | Revocar refresh token y reusar el access token antes y después de expirar | aceptado → 401 tras ≤ 15 min | T13 |
| 7 | GESTOR inicia sesión sin TOTP | no obtiene tokens | T14 |
| 8 | IAM Policy Simulator: rol de `publicProjectsFn` + `dynamodb:PutItem` | `implicitDeny` | T10 |
| 9 | 50 proyectos + carga de lectura | p95 ≤ 1.5 s (registrar herramienta y condiciones) | RNF-HU-05 |
| 10 | `curl -I <CloudFrontUrl>` | CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy` | CA-NF11.2 |
| 11 | CloudWatch Logs Insights por `requestId` | un 2xx y un 401/403, sin tokens ni `sub` | CA-NF07.2 |
| 12 | AUDITOR consulta `/v1/audit?eventType=AUTHZ_DENIED` (extensión) | eventos con `actorRef` seudónimo | HU-10 |

Guardar capturas sanitizadas (sin Account ID, tokens ni correos) en `evidence/`.

## 5. Limpieza (RNF-HU-09)

```bash
AWS_PROFILE=zerotrust-lab04 bash scripts/cleanup.sh
```

Verificar en Resource Explorer / Tag Editor (`us-east-2` y `us-east-1` para CloudWatch Logs) que no
quedan recursos.
