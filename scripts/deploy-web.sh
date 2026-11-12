#!/usr/bin/env bash
# Compila la SPA con la configuración pública de la pila y la publica en S3 + CloudFront (T095).
set -euo pipefail
cd "$(dirname "$0")/.."

STACK="${STACK:-zerotrust-lab04}"
REGION="${AWS_REGION:-us-east-2}"

output() {
  aws cloudformation describe-stacks --stack-name "$STACK" --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}

API_URL="$(output ApiUrl)"
ISSUER="$(output UserPoolIssuer)"
CLIENT_ID="$(output SpaClientId)"
DOMAIN="$(output CognitoDomainUrl)"
BUCKET="$(output WebBucketName)"
DIST="$(output WebDistributionId)"
WEB="$(output WebUrl)"

# Valores públicos (no secretos). .env* está en .gitignore.
cat > frontend/.env.production.local <<ENV
VITE_API_URL=$API_URL
VITE_COGNITO_AUTHORITY=$ISSUER
VITE_COGNITO_CLIENT_ID=$CLIENT_ID
VITE_COGNITO_DOMAIN=$DOMAIN
ENV

echo "▶ Compilando SPA"
npm run build -w frontend

echo "▶ Publicando en s3://$BUCKET"
aws s3 sync frontend/dist "s3://$BUCKET" --delete --region "$REGION" \
  --exclude index.html --cache-control "public,max-age=31536000,immutable"
aws s3 cp frontend/dist/index.html "s3://$BUCKET/index.html" --region "$REGION" \
  --cache-control "no-cache"

echo "▶ Invalidando CloudFront"
aws cloudfront create-invalidation --distribution-id "$DIST" --paths "/index.html" "/" >/dev/null

echo "✔ Frontend disponible en $WEB"
