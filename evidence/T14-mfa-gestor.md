<!-- @trace HU-11, RNF-HU-02, CA-11.1, CA-11.2, T14 -->
# T14 · GESTOR sin segundo factor no obtiene tokens

| Campo | Valor |
|---|---|
| Fecha | 2026-11-11 (hora de Lima) |
| Ejecutó | Integrante DevOps/AWS |
| Entorno | Pila `zerotrust-lab04`, stage `academic`, región `us-east-2`; trigger `PreAuthFn` desplegado |
| Procedimiento | `tests/manual/T14-mfa-gestor.md` |
| Usuarios | Solo ficticios (`docs/test-users.md`) |

## Resultado

**Aprobada.** Un usuario del grupo `GESTOR` sin TOTP configurado **no pudo iniciar sesión**: Cognito rechazó la autenticación con el error del trigger de pre-autenticación y no emitió tokens ni redirigió a `/callback`.

## Pasos y observaciones

### 1. Usuario de la prueba

Se creó `gestor-sin-mfa@example.com` y se agregó a `GESTOR` **sin** enrolar TOTP:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/create-test-user.ps1 -Email gestor-sin-mfa@example.com -Group GESTOR -SkipMfa
```

Verificación posterior con `aws cognito-idp admin-get-user` y `admin-list-groups-for-user`:

| Usuario | Estado | Grupo | `UserMFASettingList` | MFA preferido |
|---|---|---|---|---|
| `gestor-sin-mfa@example.com` | CONFIRMED | GESTOR | *(vacío)* | *(ninguno)* |

### 2. Intento de inicio de sesión (SPA → managed login)

Se inició sesión con `gestor-sin-mfa@example.com` desde la SPA. Mensaje observado en la pantalla de managed login:

> **PreAuthentication failed with error Las cuentas con privilegios requieren MFA TOTP configurado.**

- No hubo redirección a `/callback`.
- No se emitieron tokens.
- El texto corresponde al mensaje del trigger `backend/src/identity/preAuth.ts`.

Captura: `evidence/img/T14-login-denegado.png` *(guardar la captura sanitizada con este nombre)*.

### 3. GESTOR y AUDITOR con TOTP

Los usuarios que sí enrolaron TOTP antes de entrar al grupo tienen el factor preferido (`aws cognito-idp admin-get-user`, 2026-11-11):

| Usuario | Grupo | `UserMFASettingList` | MFA preferido |
|---|---|---|---|
| `gestor1@example.com` | GESTOR | `SOFTWARE_TOKEN_MFA` | `SOFTWARE_TOKEN_MFA` |
| `auditor1@example.com` | AUDITOR | `SOFTWARE_TOKEN_MFA` | `SOFTWARE_TOKEN_MFA` |

Con `gestor1`, tras la contraseña Cognito pide el código TOTP; el inicio de sesión se completó solo con el código (flujo usado para crear y publicar el proyecto de prueba). *[Confirmar con captura de la pantalla que pide el código de 6 dígitos.]*

## Qué demuestra

- **CA-11.2:** un GESTOR sin segundo factor no obtiene tokens.
- **CA-11.1:** GESTOR y AUDITOR tienen TOTP (no SMS) como método preferido.
- **Zero Trust (RNF-HU-02):** el control se aplica en el servidor (Cognito + trigger), no en la interfaz.

## Limitación documentada

El trigger de pre-autenticación **no se ejecuta al renovar con el refresh token** (vigencia máxima de 60 min). Ese refresh token solo existe si el inicio de sesión inicial pasó el control (`specs/001-donaciones-seguras/research.md`, R-02).

## Pruebas automáticas relacionadas

- `backend/test/unit/identity/preAuth.test.ts`: comportamiento del trigger.
- `infra/test/template.test.ts`: `MfaConfiguration: OPTIONAL`, solo `SOFTWARE_TOKEN_MFA`, sin SMS y trigger configurado.
