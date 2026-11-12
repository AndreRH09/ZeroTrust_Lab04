#!/usr/bin/env bash
# T13 - Token revocado usado antes de expirar (HU-03, CA-03.3, CA-03.4). Procedimiento:
# tests/manual/T13-revocacion.md. Limitacion documentada (design.md SS6.3): el JWT authorizer de
# API Gateway valida firma y expiracion localmente, asi que un access token ya revocado sigue
# aceptado hasta que expira; la ventana queda acotada por AccessTokenValidity (15 min).
#
# El script NO imprime tokens. Toma DONOR_TOKEN y DONOR_REFRESH_TOKEN del entorno; cargalos sin
# copiar y pegar (los saltos de linea rompen el JWT):
#   COGNITO_DOMAIN=... CLIENT_ID=... node scripts/get-tokens.mjs DONOR > ~/donor.env
#   source ~/donor.env && rm ~/donor.env
#   bash scripts/t13-revocacion.sh        # tarda ~15 min: espera a que venza el access token
set -uo pipefail

COGNITO_DOMAIN="${COGNITO_DOMAIN:-https://zerotrust-lab04-aqp.auth.us-east-2.amazoncognito.com}"
CLIENT_ID="${CLIENT_ID:-5iln8ismuog3palsrebjptrafe}"
API_URL="${API_URL:-https://f0yj0946gl.execute-api.us-east-2.amazonaws.com/academic}"
: "${DONOR_TOKEN:?Falta DONOR_TOKEN (ver instrucciones al inicio del script)}"
: "${DONOR_REFRESH_TOKEN:?Falta DONOR_REFRESH_TOKEN}"

# Limpia saltos de linea y espacios que se cuelan al copiar y pegar.
DONOR_TOKEN="$(printf %s "$DONOR_TOKEN" | tr -d '\n\r ')"
DONOR_REFRESH_TOKEN="$(printf %s "$DONOR_REFRESH_TOKEN" | tr -d '\n\r ')"

fmt() { date -u -d "@$1" '+%H:%M:%S UTC'; }
lima() { date -u -d "@$(($1 - 18000))" '+%H:%M:%S'; }
code() { curl -4 -s -o /dev/null -w '%{http_code}' --max-time 20 "$@"; }

# Horas de emision y expiracion (solo se leen iat y exp del cuerpo del token; no se muestran claves).
read -r IAT EXP < <(node -e '
  const p = JSON.parse(Buffer.from(process.env.DONOR_TOKEN.split(".")[1], "base64url").toString());
  console.log(p.iat, p.exp);
')
NOW=$(date -u +%s)
echo "== T13 · revocacion de tokens =="
echo "Emitido:                 $(fmt "$IAT")  (Lima $(lima "$IAT"))"
echo "El access token vence:   $(fmt "$EXP")  (Lima $(lima "$EXP"))   vida = $((EXP - IAT)) s"
if [ "$EXP" -le "$NOW" ]; then echo "El access token ya vencio: obten uno nuevo y repite."; exit 1; fi

echo
echo "-- 0) Antes de revocar: GET /v1/donations/me con el access token"
c0=$(code -H "Authorization: Bearer $DONOR_TOKEN" "$API_URL/v1/donations/me"); echo "   HTTP $c0 (esperado 200)"

echo "-- 1) Revocar el refresh token (POST /oauth2/revoke)"
T_REV=$(date -u +%s)
rv=$(curl -4 -s -o /dev/null -w '%{http_code}' --max-time 20 -X POST "$COGNITO_DOMAIN/oauth2/revoke" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "token=$DONOR_REFRESH_TOKEN" --data-urlencode "client_id=$CLIENT_ID")
echo "   HTTP $rv a las $(fmt "$T_REV") (Lima $(lima "$T_REV")) (esperado 200)"

echo "-- 2) Intentar renovar con el refresh token revocado (grant_type=refresh_token)"
err=$(curl -4 -s --max-time 20 -X POST "$COGNITO_DOMAIN/oauth2/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "grant_type=refresh_token" --data-urlencode "client_id=$CLIENT_ID" \
  --data-urlencode "refresh_token=$DONOR_REFRESH_TOKEN" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).error||"(sin error)")}catch{console.log("(respuesta no JSON)")}})')
echo "   error devuelto: $err (esperado invalid_grant)"

echo "-- 3) Despues de revocar y ANTES de expirar: GET /v1/donations/me con el MISMO access token"
T3=$(date -u +%s); c3=$(code -H "Authorization: Bearer $DONOR_TOKEN" "$API_URL/v1/donations/me")
echo "   HTTP $c3 a las $(fmt "$T3") (Lima $(lima "$T3")) (esperado 200: limitacion documentada)"

WAIT=$((EXP - $(date -u +%s) + 15))
echo "-- 4) Esperando $WAIT s hasta que venza el access token ..."
[ "$WAIT" -gt 0 ] && sleep "$WAIT"
T4=$(date -u +%s); c4=$(code -H "Authorization: Bearer $DONOR_TOKEN" "$API_URL/v1/donations/me")
echo "   HTTP $c4 a las $(fmt "$T4") (Lima $(lima "$T4")) (esperado 401)"

echo
echo "== Resumen (sin tokens) =="
printf '%-46s %s\n' "Antes de revocar" "HTTP $c0"
printf '%-46s %s\n' "Revocacion del refresh token" "HTTP $rv"
printf '%-46s %s\n' "Renovar con el refresh revocado" "$err"
printf '%-46s %s\n' "Access token tras revocar, antes de expirar" "HTTP $c3"
printf '%-46s %s\n' "Access token despues de expirar" "HTTP $c4"
printf '%-46s %s s (%s min)\n' "Ventana de exposicion tras revocar" "$((EXP - T_REV))" "$(( (EXP - T_REV) / 60 ))"
ok=0; [ "$c0" = 200 ] && [ "$c3" = 200 ] && [ "$c4" = 401 ] && [ "$err" = invalid_grant ] && ok=1
[ "$ok" = 1 ] && echo "T13: resultado conforme a lo esperado" || echo "T13: algun paso no coincide con lo esperado; revisar"
