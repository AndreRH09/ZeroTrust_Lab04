#!/usr/bin/env bash
# Despliega la pila SAM (T029/T095). Usa credenciales temporales (AWS CloudShell o SSO), nunca
# llaves de larga duración. Región única del proyecto: us-east-2 (confirmar en AWS Settings).
#
#   AWS_PROFILE=zerotrust-lab04 npm run deploy:api
#   Variables opcionales: STACK, AWS_REGION, DOMAIN_PREFIX, ENABLE_AVP=true
set -euo pipefail
cd "$(dirname "$0")/.."

STACK="${STACK:-zerotrust-lab04}"
REGION="${AWS_REGION:-us-east-2}"
DOMAIN_PREFIX="${DOMAIN_PREFIX:-zerotrust-lab04-aqp}"
ENABLE_AVP="${ENABLE_AVP:-false}"

output() {
  aws cloudformation describe-stacks --stack-name "$STACK" --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text 2>/dev/null || true
}

deploy() {
  local web_origin="$1"
  local params=(Stage=academic "CognitoDomainPrefix=$DOMAIN_PREFIX" "EnableAvp=$ENABLE_AVP")
  [[ -n "$web_origin" ]] && params+=("WebOrigin=$web_origin")
  sam deploy \
    --template-file infra/template.yaml \
    --stack-name "$STACK" \
    --region "$REGION" \
    --resolve-s3 \
    --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND \
    --no-fail-on-empty-changeset \
    --parameter-overrides "${params[@]}"
}

echo "▶ Empaquetando Lambdas"
npm run build -w backend

current="$(output WebUrl)"
echo "▶ Desplegando pila $STACK en $REGION"
deploy "$current"

web="$(output WebUrl)"
if [[ "$web" != "$current" ]]; then
  # Primer despliegue: CloudFront ya existe; se registra su origen en Cognito y CORS.
  echo "▶ Registrando $web como WebOrigin (callback de Cognito y CORS)"
  deploy "$web"
fi

echo
aws cloudformation describe-stacks --stack-name "$STACK" --region "$REGION" \
  --query "Stacks[0].Outputs[].[OutputKey,OutputValue]" --output table
