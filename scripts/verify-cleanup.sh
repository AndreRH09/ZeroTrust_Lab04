#!/usr/bin/env bash
# Verifica (SOLO LECTURA) qué recursos del laboratorio ZeroTrust siguen en la cuenta (CA-NF09.2, T106).
# Se ejecuta antes de la limpieza (estado inicial) y despues (debe dar 0 en todo).
#
#   AWS_PROFILE=zerotrust-lab04 bash scripts/verify-cleanup.sh
#
# Alcance: solo recursos propios del laboratorio (prefijo "zerotrust-lab04" y la pila de artefactos
# de SAM). NO incluye las pilas de Amplify (notesapp) ni CDKToolkit, que pertenecen a otro laboratorio.
# Equivale a la verificacion con Resource Explorer sin depender de que este activado.
set -uo pipefail
export MSYS_NO_PATHCONV=1
R="${AWS_REGION:-us-east-2}"
PREFIX="${PREFIX:-zerotrust-lab04}"
total=0

# count "<titulo>" <region> <comando aws ...> : imprime cuantos recursos devuelve la consulta
count() {
  local title=$1 region=$2; shift 2
  local out n
  out=$(aws "$@" --region "$region" --output text 2>/dev/null | tr '\t' '\n' | grep -v -E '^(None|null|)$' || true)
  n=$(printf '%s' "$out" | grep -c . || true)
  total=$((total + n))
  printf '%-46s %-10s %s\n' "$title" "($region)" "$n"
  [ "$n" -gt 0 ] && printf '%s\n' "$out" | sed 's/^/      - /'
  return 0
}

echo "== Recursos del laboratorio que siguen en la cuenta =="
count "Pilas de CloudFormation" "$R" cloudformation list-stacks \
  --stack-status-filter CREATE_IN_PROGRESS CREATE_COMPLETE ROLLBACK_COMPLETE ROLLBACK_FAILED UPDATE_COMPLETE UPDATE_ROLLBACK_COMPLETE DELETE_FAILED \
  --query "StackSummaries[?starts_with(StackName,'$PREFIX') || StackName=='aws-sam-cli-managed-default'].StackName"
count "Buckets de S3" "$R" s3api list-buckets \
  --query "Buckets[?contains(Name,'$PREFIX') || contains(Name,'aws-sam-cli-managed-default')].Name"
count "Funciones Lambda" "$R" lambda list-functions \
  --query "Functions[?starts_with(FunctionName,'$PREFIX')].FunctionName"
count "Tablas de DynamoDB" "$R" dynamodb list-tables \
  --query "TableNames[?starts_with(@,'$PREFIX')]"
count "User pools de Cognito" "$R" cognito-idp list-user-pools --max-results 60 \
  --query "UserPools[?starts_with(Name,'$PREFIX')].Name"
count "APIs HTTP (API Gateway)" "$R" apigatewayv2 get-apis \
  --query "Items[?starts_with(Name,'$PREFIX')].ApiId"
count "Roles de IAM" "$R" iam list-roles \
  --query "Roles[?starts_with(RoleName,'$PREFIX')].RoleName"
count "Distribuciones de CloudFront (global)" "us-east-1" cloudfront list-distributions \
  --query "DistributionList.Items[?contains(Origins.Items[0].DomainName,'$PREFIX')].Id"
count "Grupos de logs" "$R" logs describe-log-groups --log-group-name-prefix "$PREFIX" \
  --query "logGroups[].logGroupName"
count "Grupos de logs" "us-east-1" logs describe-log-groups --log-group-name-prefix "$PREFIX" \
  --query "logGroups[].logGroupName"

echo "------------------------------------------------------------"
if [ "$total" -eq 0 ]; then
  echo "OK: no queda ningun recurso del laboratorio (total = 0)."
else
  echo "Quedan $total recursos del laboratorio."
  exit 1
fi
