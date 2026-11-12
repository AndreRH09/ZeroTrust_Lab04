# Declaración de uso de IA (design.md §10)

Todo cambio asistido por IA entra por PR y debe ser revisado por un integrante distinto de quien lo
generó. No se compartieron con los asistentes credenciales AWS, tokens, `.env` ni datos personales
reales, y ningún agente ejecutó despliegues sobre la cuenta AWS.

| Campo | Contenido |
|---|---|
| Herramienta/modelo | Claude (Anthropic), Claude Opus 5.5 / Sonnet 5.5 mediante Claude Code |
| Participantes | Cesar Garay |
| Tareas asistidas | Implementación del MVP según `specs/001-donaciones-seguras/tasks.md`: monorepo y CI (Fase 1), esquemas Zod, `authz`, logger y auditoría (Fase 2), Lambdas de HU-01 a HU-11, HU-10 y adaptador HU-12, extensión de `infra/template.yaml` (funciones, roles IAM, trigger MFA, CloudFront, AVP), SPA React, pruebas unitarias/UI/IaC, colección Bruno, scripts de despliegue y documentación |
| Aportes IA | Código y pruebas en `shared/`, `backend/`, `frontend/`, `infra/test/`, `policies/`, `tests/`, `scripts/`; documentos `README.md`, `docs/threat-model.md`, `docs/test-users.md`, `tests/manual/*`. PR: rama `feat/mvp-backend-frontend` |
| Validación humana | Pendiente: revisión del PR por otro integrante, despliegue en el stage `academic` y ejecución de T01–T14 con evidencia en `evidence/`. Verificado localmente: lint, formato, typecheck, 300+ pruebas automáticas, `cfn-lint` sin hallazgos y build de Lambdas y SPA |
| Limitaciones | No se desplegó en AWS desde el asistente: el comportamiento real de Cognito (managed login, trigger Pre authentication, revocación), CloudFront/CSP y la colección Bruno no se han ejecutado contra la cuenta. Las políticas Cedar se probaron con un evaluador simulado, no contra Verified Permissions. Las decisiones de IAM (`userpool/*` en `PreAuthFn`) y de seguridad deben ser revisadas y explicadas por el equipo |
