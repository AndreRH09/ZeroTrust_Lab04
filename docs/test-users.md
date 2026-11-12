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

## 2. Cómo se crean

Se usa `scripts/create-test-user.ps1`, que ejecuta los comandos de `aws cognito-idp` en el orden correcto. Requiere sesión iniciada (`aws login --profile zerotrust-lab04`) y se ejecuta desde la raíz del repo:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/create-test-user.ps1 -Email donante1@example.com -Group DONANTE
powershell -ExecutionPolicy Bypass -File scripts/create-test-user.ps1 -Email donante2@example.com -Group DONANTE
powershell -ExecutionPolicy Bypass -File scripts/create-test-user.ps1 -Email gestor1@example.com -Group GESTOR
powershell -ExecutionPolicy Bypass -File scripts/create-test-user.ps1 -Email auditor1@example.com -Group AUDITOR
```

- La contraseña se pide por consola (`SecureString`); no se escribe en ningún archivo. Política del user pool: 12 o más caracteres con mayúscula, minúscula, número y símbolo.
- El script obtiene el `UserPoolId` y el `AdminCliClientId` desde los outputs de la pila, sin copiarlos a mano.

### Orden que sigue el script

1. `admin-create-user` con `--message-action SUPPRESS` (sin correo real) y `admin-set-user-password --permanent`.
2. **DONANTE:** `admin-add-user-to-group`. Sin MFA, según la matriz de roles.
3. **GESTOR y AUDITOR**, con TOTP **antes** de asignar el grupo:
   `admin-initiate-auth` con el cliente `admin-cli` → `associate-software-token` → `verify-software-token` → `admin-set-user-mfa-preference` → `admin-add-user-to-group`.

El orden importa: el trigger de pre-autenticación (T027) bloquea el inicio de sesión de quien ya pertenece a `GESTOR` o `AUDITOR` sin TOTP, y se necesita iniciar sesión para enrolar.

> El enrolamiento imprime el `SecretCode` **una sola vez**. No se captura ni se pega en el repo, el informe o un chat. Si se filtra, se elimina el usuario y se repite.

## 3. Verificación

El script termina mostrando el estado del usuario, su método MFA preferido y sus grupos. Para GESTOR y AUDITOR debe aparecer `SOFTWARE_TOKEN_MFA`. También se puede repetir:

```powershell
aws cognito-idp admin-get-user --user-pool-id <UserPoolId> --username gestor1@example.com --query "{mfa:UserMFASettingList,preferido:PreferredMfaSetting}" --region us-east-2 --profile zerotrust-lab04
```

## 4. Evidencia que se guarda

- Captura de los usuarios en Cognito (consola → User pools → Users), con grupos.
- Captura del resumen final del script (sin el secreto: la pantalla se limpia antes de mostrarlo).
- Para **T14** (login de GESTOR sin segundo factor): ver `evidence/` cuando el trigger T027 esté desplegado.

## 5. Limpieza

Los usuarios pertenecen al user pool y se eliminan con la pila (`sam delete`). Ver `evidence/RNF-HU-09-limpieza.md`.
