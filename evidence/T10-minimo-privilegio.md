<!-- @trace RNF-HU-03, CA-NF03.1, CA-NF03.2, T10 -->
# T10 · La Lambda de listado no puede escribir en DynamoDB

| Campo | Valor |
|---|---|
| Fecha | 2026-11-11 (hora de Lima) |
| Ejecutó | Integrante DevOps/AWS |
| Entorno | Pila `zerotrust-lab04`, `us-east-2` |
| Método | IAM `SimulatePrincipalPolicy` (solo lectura) por CLI: `scripts/simulate-t10.ps1` |
| Rol evaluado | `PublicProjectsRole` (función `PublicProjectsFn`: `GET /v1/projects`, detalle y estadísticas) |
| Procedimiento | `tests/manual/T10-minimo-privilegio.md` |

## Resultado

**Aprobada.** El rol de la función pública puede **leer** la tabla `Projects` (`GetItem`, `Query` sobre el índice `status-createdAt`) y **no puede** escribir en ella, ni leer o escribir en otras tablas.

| Acción simulada | Recurso | Decisión |
|---|---|---|
| `dynamodb:GetItem` | Tabla `Projects` | **allowed** |
| `dynamodb:Query` | Índice `Projects/index/status-createdAt` | **allowed** |
| `dynamodb:PutItem` | Tabla `Projects` | **implicitDeny** |
| `dynamodb:UpdateItem` | Tabla `Projects` | **implicitDeny** |
| `dynamodb:DeleteItem` | Tabla `Projects` | **implicitDeny** |
| `dynamodb:BatchWriteItem` | Tabla `Projects` | **implicitDeny** |
| `dynamodb:Scan` | Tabla `Projects` | **implicitDeny** |
| `dynamodb:GetItem`, `dynamodb:Query` | Tabla `Donations` | **implicitDeny** |
| `dynamodb:PutItem` | Tabla `AuditEvents` | **implicitDeny** |

Salida del script (Account ID tapado): `evidence/img/T10-simulacion.png` *(guardar la captura sanitizada con este nombre)*.

## Hallazgo: las SCP administradas alteran el simulador

La primera simulación, **sin datos de contexto**, devolvió `explicitDeny` para **todas** las acciones, incluso `GetItem`, que la función usa con éxito en producción (el catálogo carga). El detalle mostraba:

```json
"MatchedStatements": [],
"OrganizationsDecisionDetail": { "AllowedByOrganizations": false }
```

- **Causa:** la cuenta pertenece a la «nueva experiencia» de AWS, que aplica **SCP/RCP administradas por AWS**. El simulador las evalúa sin los datos de una llamada real (por ejemplo `aws:RequestedRegion`), y las niega.
- **Solución:** pasar a `simulate-principal-policy` los datos de contexto `aws:RequestedRegion=us-east-2` y `aws:SecureTransport=true`. Con eso `AllowedByOrganizations` pasa a `true` y las decisiones reflejan las políticas del rol.
- **Moraleja:** un `explicitDeny` sin `MatchedStatements` no proviene de la política del rol; hay que revisar `OrganizationsDecisionDetail` antes de concluir.

## Auditoría de los roles de la pila

Se leyeron las políticas en línea de los **7 roles** (`scripts/simulate-t10.ps1`). Resultado:

| Rol | Acciones permitidas | `Action: "*"` | `Resource: "*"` | Recursos con comodín parcial |
|---|---|---|---|---|
| `PublicProjectsRole` | 4 | no | no | `…:log-group:<nombre propio>:*` (flujos de logs de su propio grupo) |
| `ManageProjectsRole` | 7 | no | no | ídem |
| `CreateDonationRole` | 8 | no | no | ídem |
| `SimulateDonationRole` | 6 | no | no | ídem |
| `ReadDonationsRole` | 5 | no | no | ídem |
| `AuditRole` | 4 | no | no | ídem |
| `PreAuthRole` | 4 | no | no | ídem, y **`userpool/*`** (excepción documentada) |

- **Sin `Action: "*"` ni `Resource: "*"`** en ningún rol (CA-NF03.2).
- **Un rol por función**, con ARNs de tabla e índice explícitos (CA-NF03.1).
- **Excepción justificada:** `PreAuthRole` usa `arn:aws:cognito-idp:<región>:<cuenta>:userpool/*` con solo `AdminGetUser` y `AdminListGroupsForUser`, por la dependencia circular pool → trigger → política → pool (`research.md` R-02).
- **Comodín parcial en los logs:** el `:*` al final del ARN de cada grupo de logs es el sufijo de los flujos de logs de **ese** grupo, no un comodín sobre otros recursos.
- **Política del bucket del frontend:** incluye un `Deny` con `s3:*` para peticiones sin TLS (`aws:SecureTransport = false`), una restricción, no un permiso; el único `Allow` es `s3:GetObject` para CloudFront (OAC).

## Validación de políticas con IAM Access Analyzer (T097)

`tests/manual/T10-minimo-privilegio.md` pide revisar los roles con IAM Access Analyzer. En esta cuenta **solo la validación de políticas está incluida** en el Free plan; el análisis de acceso externo (analizadores de acceso) no está soportado (`docs/aws-account.md` §3). Se usó la validación, que evalúa cada documento de política sin tocar ningún recurso:

```bash
aws accessanalyzer validate-policy --policy-type IDENTITY_POLICY --policy-document file://<politica>.json
```

Se validaron las **14 políticas en línea de los 7 roles** de la pila (se obtuvieron con `aws iam get-role-policy`):

| Rol | Políticas validadas | Hallazgos (errores, avisos de seguridad, advertencias, sugerencias) |
|---|---|---|
| `PublicProjectsRole` | `logs`, `projects-read` | 0 |
| `ManageProjectsRole` | `logs`, `projects-write` | 0 |
| `CreateDonationRole` | `logs`, `donations-create` | 0 |
| `SimulateDonationRole` | `logs`, `donations-simulate` | 0 |
| `ReadDonationsRole` | `logs`, `donations-read` | 0 |
| `AuditRole` | `logs`, `audit-read` | 0 |
| `PreAuthRole` | `logs`, `cognito-read` | 0 |

**Resultado: 14 políticas validadas, 0 hallazgos.**

Alcance y límites de esta comprobación:

- Valida la **sintaxis y las buenas prácticas** de las políticas de identidad; no sustituye la simulación de la sección anterior ni el análisis de acceso externo, que no está disponible.
- No incluye las políticas de confianza (quién puede asumir cada rol): todas permiten únicamente al servicio `lambda.amazonaws.com`.
- La excepción `userpool/*` de `PreAuthRole` está documentada y justificada arriba; el validador no la marca.

## Pruebas automáticas relacionadas

`infra/test/template.test.ts` verifica en cada ejecución que `PublicProjectsRole` solo tiene `dynamodb:GetItem` y `dynamodb:Query`, que cada función tiene rol propio y que no hay `Allow` con `Action: "*"` ni `Resource: "*"`.
