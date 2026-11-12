# Usuarios de prueba (T030)

> Trazabilidad: CA-NF10.1, CA-11.1, CA-11.2 · Solo identidades **ficticias** con correos de prueba.
> No guardar contraseñas, secretos TOTP ni tokens en el repositorio.

Variables (salidas de la pila):

```bash
STACK=zerotrust-lab04; REGION=us-east-2
out() { aws cloudformation describe-stacks --stack-name $STACK --region $REGION \
  --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text; }
POOL=$(out UserPoolId); ADMIN_CLI=$(out AdminCliClientId)
```

## 1. Crear un usuario (todos los roles)

```bash
EMAIL=donante1@example.com
aws cognito-idp admin-create-user --region $REGION --user-pool-id $POOL --username $EMAIL \
  --user-attributes Name=email,Value=$EMAIL Name=email_verified,Value=true --message-action SUPPRESS
read -rs -p "Contraseña (≥12, mayúscula, minúscula, número, símbolo): " PASS; echo
aws cognito-idp admin-set-user-password --region $REGION --user-pool-id $POOL \
  --username $EMAIL --password "$PASS" --permanent
```

## 2. DONANTE (MFA opcional)

```bash
aws cognito-idp admin-add-user-to-group --region $REGION --user-pool-id $POOL \
  --username $EMAIL --group-name DONANTE
```

Crear al menos dos donantes (`donante1`, `donante2`) para la prueba BOLA T09.

## 3. GESTOR y AUDITOR: enrolar TOTP **antes** de asignar el grupo

El trigger `PreAuthFn` deniega el inicio de sesión a GESTOR/AUDITOR sin TOTP preferido (T14). Por
eso el enrolamiento se hace mientras el usuario aún no pertenece al grupo, con el app client
`admin-cli` (solo `ALLOW_ADMIN_USER_PASSWORD_AUTH`: exige credenciales IAM del equipo).

```bash
EMAIL=gestor1@example.com   # repetir para auditor1@example.com
# (crear el usuario con el paso 1)
AT=$(aws cognito-idp admin-initiate-auth --region $REGION --user-pool-id $POOL --client-id $ADMIN_CLI \
  --auth-flow ADMIN_USER_PASSWORD_AUTH --auth-parameters USERNAME=$EMAIL,PASSWORD="$PASS" \
  --query AuthenticationResult.AccessToken --output text)

# Secreto TOTP → agregarlo manualmente a la app autenticadora (Google Authenticator, Aegis, …).
aws cognito-idp associate-software-token --region $REGION --access-token "$AT" --query SecretCode --output text

read -r -p "Código de 6 dígitos: " CODE
aws cognito-idp verify-software-token --region $REGION --access-token "$AT" --user-code $CODE \
  --friendly-device-name autenticador
aws cognito-idp admin-set-user-mfa-preference --region $REGION --user-pool-id $POOL --username $EMAIL \
  --software-token-mfa-settings Enabled=true,PreferredMfa=true
unset AT

aws cognito-idp admin-add-user-to-group --region $REGION --user-pool-id $POOL \
  --username $EMAIL --group-name GESTOR   # o AUDITOR
```

Verificación (CA-11.1):

```bash
aws cognito-idp admin-get-user --region $REGION --user-pool-id $POOL --username $EMAIL \
  --query "{mfa:UserMFASettingList,preferred:PreferredMfaSetting}"
```

> El `SecretCode` se imprime **una sola vez**: no se captura ni se pega en el repo, el informe o un chat.

## 3.1 Variante para Windows (PowerShell)

`scripts/create-test-user.ps1` ejecuta los mismos pasos en el orden correcto, pide la contraseña por consola (`SecureString`, no se escribe en ningún archivo) y limpia la pantalla después de mostrar el secreto TOTP. Requiere sesión iniciada (`aws login --profile zerotrust-lab04`) y se ejecuta desde la raíz del repo:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/create-test-user.ps1 -Email donante1@example.com -Group DONANTE
powershell -ExecutionPolicy Bypass -File scripts/create-test-user.ps1 -Email gestor1@example.com -Group GESTOR
powershell -ExecutionPolicy Bypass -File scripts/create-test-user.ps1 -Email gestor-sin-mfa@example.com -Group GESTOR -SkipMfa
```

`-SkipMfa` solo se usa para el usuario de la prueba **T14** (ver §4): lo agrega al grupo sin enrolar TOTP.

## 4. Usuario para T14 (GESTOR sin TOTP)

Crear `gestor-sin-mfa@example.com` con el paso 1 y agregarlo directamente a `GESTOR` sin el paso 3.
Al iniciar sesión en la SPA, managed login muestra el error del trigger y no se emiten tokens.
Esta prueba solo tiene sentido **después** de desplegar `PreAuthFn`.

## 5. Tokens para pruebas de API

```bash
COGNITO_DOMAIN=$(out CognitoDomainUrl) CLIENT_ID=$(out SpaClientId) node scripts/get-tokens.mjs DONOR
# Pegar los `export …` impresos en la terminal (no en archivos). Repetir con DONOR_B y GESTOR.
export API_URL=$(out ApiUrl) ID_TOKEN=$DONOR_ID_TOKEN
```

## 6. Usuarios creados

Verificados con `admin-get-user` y `admin-list-groups-for-user` el 2026-11-11 (todos en estado `CONFIRMED`):

| Usuario (ficticio) | Grupo | MFA TOTP | Uso | Estado |
|---|---|---|---|---|
| donante1@example.com | DONANTE | opcional (sin MFA) | T02–T09, T13 | Creado |
| donante2@example.com | DONANTE | opcional (sin MFA) | T09 (BOLA) | Creado |
| gestor1@example.com | GESTOR | sí (`SOFTWARE_TOKEN_MFA` preferido) | HU-08, T03, T12 | Creado |
| auditor1@example.com | AUDITOR | sí (`SOFTWARE_TOKEN_MFA` preferido) | HU-10 | Creado |
| gestor-sin-mfa@example.com | GESTOR | no | T14 | Pendiente |

## 7. Evidencia que se guarda

- Captura de los usuarios en Cognito (consola → User pools → Users), con grupos.
- Captura del resumen final del script o de la verificación de MFA (sin el secreto).
- Para **T14**: ver `evidence/` cuando `PreAuthFn` esté desplegado.

## 8. Limpieza

Los usuarios pertenecen al user pool y se eliminan con la pila (`sam delete`). Ver `evidence/RNF-HU-09-limpieza.md`.
