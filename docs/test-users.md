# Usuarios de prueba (T030)

> Trazabilidad: CA-NF10.1, CA-11.1, CA-11.2 · Pruebas T14, T02, T03, T09, T12
> Solo identidades **ficticias**. **Nunca** se guardan en el repo contraseñas, secretos TOTP, tokens ni correos reales (CA-NF01.2, CA-NF10.1).

## 1. Usuarios

| Usuario ficticio | Grupo | MFA | Uso en las pruebas |
|---|---|---|---|
| `donante1@example.com` | `DONANTE` | Opcional (sin MFA) | T02, T05, T09 (donante propietario) |
| `donante2@example.com` | `DONANTE` | Opcional (sin MFA) | T09 (consulta una donación ajena) |
| `gestor1@example.com` | `GESTOR` | **TOTP obligatorio** | T03, T12, publicar proyectos |
| `auditor1@example.com` | `AUDITOR` | **TOTP obligatorio** | HU-10 (extensión) |

El visitante no necesita usuario.

## 2. Preparación (PowerShell, dentro del repo)

Las contraseñas se piden por consola y **no se escriben en ningún archivo**. Usa contraseñas de 12 o más caracteres con mayúscula, minúscula, número y símbolo (política del user pool).

```powershell
$Profile_ = 'zerotrust-lab04'; $Region = 'us-east-2'
$Pool = aws cloudformation describe-stacks --stack-name zerotrust-lab04 --region $Region --profile $Profile_ --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text
$AdminClient = aws cloudformation describe-stacks --stack-name zerotrust-lab04 --region $Region --profile $Profile_ --query "Stacks[0].Outputs[?OutputKey=='AdminCliClientId'].OutputValue" --output text
```

## 3. DONANTE (sin MFA)

```powershell
$email = 'donante1@example.com'
$pwd1 = Read-Host 'Contraseña para el usuario de prueba' -AsSecureString
$plain = [System.Net.NetworkCredential]::new('', $pwd1).Password
aws cognito-idp admin-create-user --user-pool-id $Pool --username $email --user-attributes Name=email,Value=$email Name=email_verified,Value=true --message-action SUPPRESS --region $Region --profile $Profile_
aws cognito-idp admin-set-user-password --user-pool-id $Pool --username $email --password $plain --permanent --region $Region --profile $Profile_
aws cognito-idp admin-add-user-to-group --user-pool-id $Pool --username $email --group-name DONANTE --region $Region --profile $Profile_
```

Repetir con `donante2@example.com`.

## 4. GESTOR y AUDITOR (con TOTP, **antes** de asignar el grupo)

El orden importa: el trigger de pre-autenticación (T027) bloquea el login de quien ya está en `GESTOR` o `AUDITOR` sin TOTP. Por eso el enrolamiento se hace **antes** de añadir al grupo.

```powershell
$email = 'gestor1@example.com'
$pwd1 = Read-Host 'Contraseña para el usuario de prueba' -AsSecureString
$plain = [System.Net.NetworkCredential]::new('', $pwd1).Password

# 1) Crear el usuario con contraseña permanente
aws cognito-idp admin-create-user --user-pool-id $Pool --username $email --user-attributes Name=email,Value=$email Name=email_verified,Value=true --message-action SUPPRESS --region $Region --profile $Profile_
aws cognito-idp admin-set-user-password --user-pool-id $Pool --username $email --password $plain --permanent --region $Region --profile $Profile_

# 2) Obtener un access token con el cliente admin-cli (sin OAuth)
$auth = aws cognito-idp admin-initiate-auth --user-pool-id $Pool --client-id $AdminClient --auth-flow ADMIN_USER_PASSWORD_AUTH --auth-parameters "USERNAME=$email,PASSWORD=$plain" --region $Region --profile $Profile_ | ConvertFrom-Json
$access = $auth.AuthenticationResult.AccessToken

# 3) Asociar la app autenticadora: muestra SecretCode (secreto: NO guardarlo ni capturarlo)
aws cognito-idp associate-software-token --access-token $access --region $Region --profile $Profile_

# 4) Escribir el SecretCode en la app autenticadora y verificar con el código de 6 dígitos
$code = Read-Host 'Código TOTP de 6 dígitos'
aws cognito-idp verify-software-token --access-token $access --user-code $code --friendly-device-name gestor1 --region $Region --profile $Profile_

# 5) Activar TOTP como método preferido y recién entonces asignar el grupo
aws cognito-idp admin-set-user-mfa-preference --user-pool-id $Pool --username $email --software-token-mfa-settings Enabled=true,PreferredMfa=true --region $Region --profile $Profile_
aws cognito-idp admin-add-user-to-group --user-pool-id $Pool --username $email --group-name GESTOR --region $Region --profile $Profile_
```

Repetir con `auditor1@example.com` y el grupo `AUDITOR`.

> El paso 3 imprime el `SecretCode`. **No lo captures** ni lo pegues en el repo, el informe o un chat. Si se filtra, se elimina el usuario y se repite el enrolamiento.

## 5. Verificación

```powershell
aws cognito-idp list-users-in-group --user-pool-id $Pool --group-name GESTOR --region $Region --profile $Profile_ --query "Users[].Username"
aws cognito-idp admin-get-user --user-pool-id $Pool --username gestor1@example.com --region $Region --profile $Profile_ --query "{mfa:UserMFASettingList,preferido:PreferredMfaSetting}"
```

Debe mostrar `SOFTWARE_TOKEN_MFA` como método preferido para `GESTOR` y `AUDITOR`.

## 6. Evidencia que se guarda

- Captura de los usuarios en el user pool (consola de Cognito → Users), **tapando correos si fueran reales**.
- Captura de `admin-get-user` con `UserMFASettingList` (sin secretos).
- Para **T14** (login de GESTOR sin segundo factor): ver `evidence/` cuando el trigger T027 esté desplegado.

## 7. Limpieza

Los usuarios se eliminan con la pila (`sam delete`), porque pertenecen al user pool. Ver `evidence/RNF-HU-09-limpieza.md`.
