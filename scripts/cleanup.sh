#!/usr/bin/env bash
# Limpieza al cierre (CA-NF09.2, T106): vacía el bucket y elimina la pila.
set -euo pipefail
STACK="${STACK:-zerotrust-lab04}"
REGION="${AWS_REGION:-us-east-2}"

BUCKET="$(aws cloudformation describe-stacks --stack-name "$STACK" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='WebBucketName'].OutputValue" --output text)"
echo "▶ Vaciando s3://$BUCKET"
aws s3 rm "s3://$BUCKET" --recursive --region "$REGION"
echo "▶ sam delete $STACK"
sam delete --stack-name "$STACK" --region "$REGION" --no-prompts
echo "✔ Verifica en Resource Explorer ($REGION) y CloudWatch Logs (us-east-1) que no queden recursos."
