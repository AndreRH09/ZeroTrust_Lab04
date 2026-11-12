<!-- @trace HU-11, RNF-HU-02, CA-11.1, CA-11.2, T14 -->
# T14 · GESTOR sin segundo factor no obtiene tokens

**Automático (CI):** `backend/test/unit/identity/preAuth.test.ts` (trigger) e
`infra/test/template.test.ts` (MFA OPTIONAL, solo TOTP, trigger configurado).

**Manual:**
1. Crear un usuario ficticio y agregarlo a `GESTOR` **sin** enrolar TOTP (ver `docs/test-users.md`).
2. Iniciar sesión en la SPA → managed login muestra un error del trigger Pre authentication; no hay
   redirección a `/callback` ni tokens.
3. Con el GESTOR enrolado: tras la contraseña Cognito exige el código TOTP; sin código no hay tokens.
4. Verificar `aws cognito-idp admin-get-user` → `UserMFASettingList` contiene `SOFTWARE_TOKEN_MFA`
   para cada GESTOR/AUDITOR.
5. Captura sanitizada en `evidence/T14-mfa-gestor.md`.
