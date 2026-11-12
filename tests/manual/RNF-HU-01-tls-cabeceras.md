<!-- @trace RNF-HU-01, RNF-HU-11, CA-NF01.1, CA-NF01.2, CA-NF11.1, CA-NF11.2 -->
# HTTPS y cabeceras de seguridad

1. `curl -sI http://<WebUrl sin https>` → **301** a HTTPS (`redirect-to-https`).
2. `curl -sI https://<WebUrl>` → presentes `content-security-policy`, `strict-transport-security`,
   `x-content-type-options: nosniff`, `referrer-policy: strict-origin-when-cross-origin`, `x-frame-options: DENY`.
3. La API solo expone `https://…execute-api…` (API Gateway no sirve HTTP).
4. DevTools → Application: `localStorage` sin tokens; `sessionStorage` solo con `oidc.pkce.*`
   durante la redirección (se borra al volver).
5. `git grep -nE "eyJ[A-Za-z0-9_-]{10,}\.|AKIA[0-9A-Z]{16}"` → sin resultados (sin JWT ni llaves).
6. Guardar en `evidence/CA-NF11-cabeceras.md`.
