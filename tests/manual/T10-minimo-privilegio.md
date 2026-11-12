<!-- @trace RNF-HU-03, CA-NF03.1, CA-NF03.2, T10 -->
# T10 · La Lambda de listado no puede escribir en DynamoDB

**Automático (CI):** `infra/test/template.test.ts` verifica que `PublicProjectsRole` solo tiene
`dynamodb:GetItem` y `dynamodb:Query`, que cada función tiene rol propio y que no hay `Allow` con
`Action: "*"` ni `Resource: "*"` (excepción documentada: `userpool/*` de `PreAuthFn`).

**Manual (cuenta desplegada):**
1. IAM → Roles → rol `…PublicProjectsRole…` → *Simulate* (IAM Policy Simulator).
2. Servicio DynamoDB, acciones `PutItem`, `UpdateItem`, `DeleteItem` sobre la tabla Projects.
3. Resultado esperado: **implicitDeny** en las tres; `GetItem` y `Query` (índice `status-createdAt`) → allowed.
4. Revisar todos los roles con IAM Access Analyzer (políticas sin hallazgos críticos).
5. Guardar captura sanitizada en `evidence/T10-minimo-privilegio.md`.

**Credenciales (CA-NF03.2):** el CI (`.github/workflows/ci.yml`) no usa secretos ni credenciales AWS;
el despliegue usa credenciales temporales (CloudShell/SSO).
