<!-- @trace HU-03, CA-03.3, CA-03.4, T13 -->
# T13 · Token revocado usado antes de expirar

Limitación documentada (design.md §6.3): el JWT authorizer valida firma y expiración localmente.

1. `node scripts/get-tokens.mjs DONOR` → exportar `DONOR_TOKEN` y `DONOR_REFRESH_TOKEN`.
2. Revocar el refresh token:
   ```bash
   curl -s -X POST "$COGNITO_DOMAIN/oauth2/revoke" \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "token=$DONOR_REFRESH_TOKEN&client_id=$CLIENT_ID"
   ```
3. Intentar renovar con ese refresh token → `invalid_grant` (revocado).
4. `GET $API_URL/v1/donations/me` con `DONOR_TOKEN` **antes** de los 15 min → **200** (aceptado: limitación).
5. Repetir después de la expiración (≥ 15 min desde la emisión) → **401**.
6. Registrar horas de emisión, revocación y llamadas en `evidence/T13-revocacion.md` (sin tokens).

Ventana de exposición máxima: vida del access token (15 min, `AccessTokenValidity` en la plantilla).
