#!/usr/bin/env bash
# Smoke test del despliegue en AWS: solo peticiones HTTP públicas, sin credenciales (CA-NF03.2).
# Uso: WEB_URL=https://xxx.cloudfront.net API_URL=https://xxx/academic \
#      COGNITO_DOMAIN=https://xxx.auth.us-east-2.amazoncognito.com SPA_CLIENT_ID=xxx \
#      bash scripts/smoke-deploy.sh
set -uo pipefail
: "${WEB_URL:?}" "${API_URL:?}" "${COGNITO_DOMAIN:?}" "${SPA_CLIENT_ID:?}"

fails=0
check() { # check "<descripción>" <comando...>
  local desc=$1; shift
  if "$@" >/dev/null 2>&1; then echo "OK    $desc"; else echo "FALLA $desc"; fails=$((fails + 1)); fi
}
status() { curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$@"; }
is() { [ "$(status "${@:2}")" = "$1" ]; }

web_headers=$(curl -sI --max-time 20 "$WEB_URL/")
has_header() { grep -qiE "^$1" <<<"$web_headers"; }

# Frontend (S3 + CloudFront)
check "web: index.html responde 200" is 200 "$WEB_URL/"
check "web: ruta de la SPA devuelve index (200)" is 200 "$WEB_URL/donations/me"
check "web: CSP presente" has_header "content-security-policy:"
check "web: CSP sin 'unsafe-inline'" bash -c "! grep -qi \"unsafe-inline\" <<<\"\$0\"" "$web_headers"
check "web: HSTS" has_header "strict-transport-security:"
check "web: X-Content-Type-Options nosniff" has_header "x-content-type-options: nosniff"
check "web: X-Frame-Options DENY" has_header "x-frame-options: deny"
js=$(curl -s --max-time 20 "$WEB_URL/" | grep -oE '/assets/[^"]+\.js' | head -1)
check "web: el bundle apunta a API_URL" bash -c "curl -s --max-time 20 '$WEB_URL$js' | grep -qF '$API_URL'"

# API (HTTP API + Lambdas + DynamoDB)
check "api: GET /v1/projects público 200 con items" bash -c "curl -sf --max-time 20 '$API_URL/v1/projects' | grep -q '\"items\"'"
check "api: GET /v1/donations/me sin token -> 401" is 401 "$API_URL/v1/donations/me"
check "api: POST /v1/donations sin token -> 401" is 401 -X POST "$API_URL/v1/donations"
check "api: token falso -> 401" is 401 -H "Authorization: Bearer x.y.z" "$API_URL/v1/donations/me"
cors() { curl -sI --max-time 20 -X OPTIONS -H "Origin: $1" -H "Access-Control-Request-Method: GET" "$API_URL/v1/projects"; }
check "api: CORS permite el origen web" bash -c "grep -qiF 'access-control-allow-origin: $WEB_URL' <<<\"\$0\"" "$(cors "$WEB_URL")"
check "api: CORS rechaza origen ajeno" bash -c "! grep -qi 'access-control-allow-origin' <<<\"\$0\"" "$(cors https://evil.example.com)"

# Cognito (managed login)
redirect=$(printf %s "$WEB_URL/callback" | sed 's/:/%3A/g; s#/#%2F#g')
authorize="$COGNITO_DOMAIN/oauth2/authorize?client_id=$SPA_CLIENT_ID&response_type=code&scope=openid&redirect_uri="
check "cognito: dominio de login responde" is 200 "$COGNITO_DOMAIN/login?client_id=$SPA_CLIENT_ID&response_type=code&scope=openid&redirect_uri=$redirect"
check "cognito: callback de CloudFront registrado (302)" is 302 "$authorize$redirect"
evil_redirect=$(curl -s -o /dev/null --max-time 20 -w '%{redirect_url}' "${authorize}https%3A%2F%2Fevil.example.com%2Fcallback")
check "cognito: callback ajeno rechazado" bash -c "! grep -q '^https://evil' <<<\"\$0\"" "$evil_redirect"

echo "---"
[ "$fails" -eq 0 ] && echo "Smoke test OK" || { echo "$fails comprobaciones fallaron"; exit 1; }
