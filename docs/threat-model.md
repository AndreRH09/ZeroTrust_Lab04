# Modelo de amenazas y mapeo Zero Trust

> Trazabilidad: CA-NF02.3, RNF-HU-02, CA-04.1–3, CA-11.1–2 · Fuente: `design.md` §3 y §6.

## 1. Límites de confianza

```text
Navegador (no confiable)
  │  HTTPS (CloudFront: CSP, HSTS)            │  Auth Code + PKCE
  ▼                                            ▼
S3 privado (OAC)                       Cognito (PA: emite/revoca tokens, MFA TOTP)
  │
  │  HTTPS + Bearer access token
  ▼
API Gateway HTTP API (PEP: firma, emisor, exp, client_id, scope, throttling)
  ▼
Lambda (PE: authz → grupo + propietario + reglas de negocio)  ── rol IAM propio por función
  ▼
DynamoDB (acciones y tablas mínimas por función)
```

Nada de lo que envía el navegador se usa como identidad o rol: `sub` y `cognito:groups` salen solo
de los claims verificados (`backend/src/authz/principal.ts`).

## 2. STRIDE resumido

| Amenaza | Ejemplo | Control | Prueba |
|---|---|---|---|
| **S**poofing | Token ausente, alterado, de otro client o ID token | JWT authorizer + scopes por ruta; `token_use=access` en Lambda | T02, T11 |
| **S**poofing | `donorSub`/`groups` en el body | Zod `strict()`; principal solo de claims | `body-spoofing.bru`, `principal.test.ts` |
| **S**poofing | Robo de contraseña de GESTOR/AUDITOR | MFA TOTP obligatorio (trigger Pre authentication) | T14 |
| **T**ampering | Monto 0, negativo, decimal o enorme | `amountCents` entero 100–100000 | T04 |
| **T**ampering | Doble conteo / carrera | `TransactWriteItems` condicionado | T06–T08 |
| **R**epudiation | Acciones críticas sin rastro | `AuditEvents` con `requestId` y actor seudónimo; logs JSON; CloudTrail | CA-08.3, CA-NF07.2 |
| **I**nformation disclosure | BOLA sobre donaciones | Ownership por `sub` → 404 idéntico | T09, T12 |
| **I**nformation disclosure | Secretos en logs | Logger con redacción; sin stack en respuestas | `http.test.ts` |
| **I**nformation disclosure | XSS roba tokens | Tokens en memoria; CSP sin `unsafe-inline` | CA-NF11.1–2 |
| **D**enial of service | Ráfagas contra la API | Throttling 20 rps / 40 ráfaga → 429 | Plantilla SAM |
| **E**levation of privilege | DONANTE crea/publica proyectos | RBAC en Lambda | T03 |
| **E**levation of privilege | Lambda comprometida escribe donde no debe | Rol IAM por función, sin `*` | T10 |

## 3. Autorización (T073)

- Todos los handlers protegidos llaman `authorize()` **antes** de leer datos de negocio o validar el
  cuerpo: un DONANTE recibe 403 aunque el body sea inválido.
- Orden de decisión: rol (403) → propietario sobre el recurso persistido (404 sin revelar existencia).
- Cada denegación registra `AUTHZ_DENIED` en `AuditEvents`.
- `decide()` es el único punto de decisión; con `AUTHZ_ENGINE=avp` delega en Amazon Verified
  Permissions (HU-12) con las políticas de `policies/*.cedar` y produce decisiones idénticas
  (`avpPolicy.test.ts`).
- Ocultar opciones en la SPA es solo usabilidad: las pruebas Bruno llaman al API directamente con
  tokens de otros roles.

## 4. MFA por rol (T083, research R-02)

- Cognito configura MFA por *user pool*, no por grupo. Decisión: `MfaConfiguration: OPTIONAL`, solo
  TOTP, y el trigger **Pre authentication** (`PreAuthFn`) rechaza a GESTOR/AUDITOR sin TOTP preferido.
  Con TOTP preferido, Cognito exige el código en cada inicio de sesión.
- El app client de la SPA no concede `aws.cognito.signin.user.admin`: el usuario no puede desactivar su
  MFA desde el navegador.
- **Límite:** el trigger no corre al renovar con refresh token (≤ 60 min), pero ese token solo existe si
  el inicio de sesión inicial pasó el control.
- **Descartadas:** `MfaConfiguration: ON` para todos (contradice MFA opcional del DONANTE) y dos user
  pools (T03/T12 recibirían 401 en lugar de 403/404).

## 5. Mapeo NIST SP 800-207

| Componente NIST | Implementación |
|---|---|
| Policy Enforcement Point (PEP) | API Gateway HTTP API (JWT authorizer + scopes + throttling); CloudFront para la SPA |
| Policy Engine (PE) | `backend/src/authz/policy.ts` (embebido) o Verified Permissions + Cedar (HU-12) |
| Policy Administrator (PA) | Amazon Cognito: emite, renueva (refresh 60 min con rotación) y revoca tokens |
| Fuentes de información | Claims del access token, estado del recurso en DynamoDB, CloudWatch Logs, `AuditEvents`, CloudTrail |

| # | Principio | Control | Evidencia |
|---|---|---|---|
| 1 | Todo dato y servicio es un recurso | Cada ruta con scope + regla en `ROLE_MATRIX`; cada tabla con política IAM explícita | `template.test.ts`, `policy.test.ts` |
| 2 | Comunicación segura sin importar la red | HTTPS en CloudFront (`redirect-to-https`, HSTS) y API Gateway | CA-NF01.1 |
| 3 | Acceso por sesión y por recurso | Access token 15 min; scopes por ruta; ownership por recurso | T09, T11, T13 |
| 4 | Política dinámica | Decisión por solicitud con identidad, grupo, estado del recurso y stage | T03, T12, CA-06.1 |
| 5 | Monitorear la postura de los activos | **Parcial:** sin postura de dispositivo (Free plan); `npm audit` + Dependabot en CI; CloudTrail | Limitación declarada |
| 6 | Autenticación y autorización estrictas antes del acceso | PKCE + JWT authorizer + `authz` + MFA en roles privilegiados | T02, T11, T14 |
| 7 | Recolectar información para mejorar | Logs JSON con `requestId`, `AuditEvents`, CloudTrail | CA-NF07.2, HU-10 |

## 6. Limitaciones conocidas

- **Revocación:** un access token revocado sigue siendo válido hasta expirar (≤ 15 min) porque el JWT
  authorizer valida localmente (T13, CA-03.4). Alternativa: Lambda authorizer con lista de revocación.
- **Sin postura de dispositivo ni riesgo continuo:** Verified Access y Cognito Plus no están en el
  Free plan.
- **Sin WAF:** HTTP API no se integra con AWS WAF; se usa throttling del stage.
- **Recarga de página:** los tokens viven en memoria; al recargar se pierde la sesión de la SPA (se
  recupera con la sesión de managed login sin reingresar la contraseña mientras siga activa).
- **Auditoría best effort:** el evento se escribe después de la operación de negocio; si su escritura
  falla, la operación no se revierte y el fallo queda en los logs.
- **Cuenta compartida:** el aislamiento entre integrantes depende de IAM y de la disciplina del equipo.
