<#
  T10 - La Lambda de listado (PublicProjectsFn) no puede escribir en DynamoDB.
  Trazabilidad: RNF-HU-03, CA-NF03.1, CA-NF03.2, T10.

  SOLO LECTURA: usa iam:SimulatePrincipalPolicy (no ejecuta ninguna accion real) y lee las
  politicas en linea de los roles de la pila. Tapa el Account ID en la salida.

  Se pasan los datos de contexto aws:RequestedRegion y aws:SecureTransport porque el simulador
  aplica las SCP administradas de la cuenta (nueva experiencia de AWS) y, sin esos datos, devuelve
  explicitDeny hasta para GetItem (OrganizationsDecisionDetail.AllowedByOrganizations = false).

  Uso (desde la raiz del repo, con sesion iniciada: aws login --profile zerotrust-lab04):
    powershell -ExecutionPolicy Bypass -File scripts/simulate-t10.ps1
#>
param(
  [string]$ProfileName = 'zerotrust-lab04',
  [string]$Region = 'us-east-2',
  [string]$StackName = 'zerotrust-lab04'
)

function Invoke-Aws {
  $out = & aws @args --region $Region --profile $ProfileName
  if ($LASTEXITCODE -ne 0) { throw "Fallo el comando aws: $($args[0]) $($args[1])" }
  return $out
}
function Get-Physical([string]$LogicalId) {
  Invoke-Aws cloudformation describe-stack-resource --stack-name $StackName --logical-resource-id $LogicalId --query StackResourceDetail.PhysicalResourceId --output text
}

$acct = Invoke-Aws sts get-caller-identity --query Account --output text
$mask = { param($s) ($s -join "`n") -replace $acct, '<ACCOUNT_ID>' }

$roleName = Get-Physical 'PublicProjectsRole'
$roleArn = Invoke-Aws iam get-role --role-name $roleName --query Role.Arn --output text
$P = Get-Physical 'ProjectsTable'; $D = Get-Physical 'DonationsTable'; $A = Get-Physical 'AuditEventsTable'
$table = { param($n) "arn:aws:dynamodb:${Region}:${acct}:table/$n" }
$ctx = @('ContextKeyName=aws:RequestedRegion,ContextKeyValues=us-east-2,ContextKeyType=string',
         'ContextKeyName=aws:SecureTransport,ContextKeyValues=true,ContextKeyType=boolean')

function Simulate([string[]]$Actions, [string]$Resource, [string]$Title) {
  Write-Host "`n### $Title" -ForegroundColor Cyan
  $r = Invoke-Aws iam simulate-principal-policy --policy-source-arn $roleArn --action-names $Actions --resource-arns $Resource --context-entries $ctx --query 'EvaluationResults[].[EvalActionName,EvalDecision]' --output text
  Write-Host (& $mask $r)
}

Write-Host ("Rol evaluado: " + (& $mask $roleArn))
Simulate @('dynamodb:GetItem') (& $table $P) 'GetItem en Projects (esperado: allowed)'
Simulate @('dynamodb:Query') ((& $table $P) + '/index/status-createdAt') 'Query en el indice status-createdAt (esperado: allowed)'
Simulate @('dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:DeleteItem', 'dynamodb:BatchWriteItem') (& $table $P) 'Escrituras en Projects (esperado: implicitDeny)'
Simulate @('dynamodb:Scan') (& $table $P) 'Scan en Projects (esperado: implicitDeny)'
Simulate @('dynamodb:GetItem', 'dynamodb:Query') (& $table $D) 'Lectura en Donations, otra tabla (esperado: implicitDeny)'
Simulate @('dynamodb:PutItem') (& $table $A) 'Escritura en AuditEvents (esperado: implicitDeny)'

Write-Host "`n=== Auditoria de los roles de la pila (politicas en linea, efecto Allow) ===" -ForegroundColor Cyan
$roles = Invoke-Aws cloudformation describe-stack-resources --stack-name $StackName --query "StackResources[?ResourceType=='AWS::IAM::Role'].[LogicalResourceId,PhysicalResourceId]" --output text
foreach ($line in $roles) {
  $lid, $rn = $line -split '\s+'
  $acciones = New-Object System.Collections.Generic.List[string]
  $recursos = New-Object System.Collections.Generic.List[string]
  $names = (Invoke-Aws iam list-role-policies --role-name $rn --query 'PolicyNames' --output json | Out-String) | ConvertFrom-Json
  foreach ($pn in $names) {
    $doc = (Invoke-Aws iam get-role-policy --role-name $rn --policy-name $pn --query PolicyDocument --output json | Out-String) | ConvertFrom-Json
    foreach ($st in $doc.Statement) {
      if ($st.Effect -eq 'Allow') {
        foreach ($a in @($st.Action)) { $acciones.Add($a) }
        foreach ($r in @($st.Resource)) { $recursos.Add($r) }
      }
    }
  }
  $accionComodin = @($acciones | Where-Object { ($_ -eq '*') -or ($_ -like '*:`*') }).Count
  $recursoComodin = @($recursos | Where-Object { $_ -eq '*' }).Count
  Write-Host ('{0,-22} acciones={1,-3} Action:"*"={2} Resource:"*"={3}' -f $lid, $acciones.Count, $accionComodin, $recursoComodin)
  $parcial = @($recursos | Where-Object { $_ -ne '*' -and $_ -like '*`*' } | Sort-Object -Unique)
  foreach ($p in $parcial) { Write-Host ('    recurso con comodin parcial: ' + (& $mask $p)) }
}
