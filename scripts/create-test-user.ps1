<#
  Crea un usuario de PRUEBA en el user pool de la pila zerotrust-lab04 (T030).
  Trazabilidad: CA-NF10.1, CA-11.1, CA-11.2.

  - La contrasena se pide por consola (SecureString): no se escribe en ningun archivo.
  - GESTOR y AUDITOR: se enrola TOTP ANTES de asignar el grupo, porque el trigger
    de pre-autenticacion (T027) bloquea a los privilegiados sin TOTP.
  - El SecretCode del TOTP se imprime una sola vez: NO lo captures ni lo guardes.

  Uso (desde la raiz del repo, con la sesion iniciada: aws login --profile zerotrust-lab04):
    powershell -ExecutionPolicy Bypass -File scripts/create-test-user.ps1 -Email donante1@example.com -Group DONANTE
#>
param(
  [Parameter(Mandatory = $true)][string]$Email,
  [Parameter(Mandatory = $true)][ValidateSet('DONANTE', 'GESTOR', 'AUDITOR')][string]$Group,
  [switch]$SkipMfa,  # solo para el usuario de la prueba T14 (GESTOR sin TOTP)
  [string]$ProfileName = 'zerotrust-lab04',
  [string]$Region = 'us-east-2',
  [string]$StackName = 'zerotrust-lab04'
)

function Invoke-Aws {
  $out = & aws @args --region $Region --profile $ProfileName
  if ($LASTEXITCODE -ne 0) { throw "Fallo el comando aws: $($args[0]) $($args[1])" }
  return $out
}

function Get-StackOutput([string]$Key) {
  $v = Invoke-Aws cloudformation describe-stacks --stack-name $StackName --query "Stacks[0].Outputs[?OutputKey=='$Key'].OutputValue" --output text
  if (-not $v) { throw "No se encontro el output $Key en la pila $StackName" }
  return $v
}

if ($Email -notmatch '^[^@\s]+@[^@\s]+\.[^@\s]+$') { throw 'El correo no es valido.' }
if ($Email -notmatch '@example\.com$') { Write-Warning 'Usa correos ficticios @example.com (CA-NF10.1).' }

$Pool = Get-StackOutput 'UserPoolId'
$AdminClient = Get-StackOutput 'AdminCliClientId'
Write-Host "User pool: $Pool  |  Region: $Region"

$secure = Read-Host 'Contrasena del usuario de prueba (12+ caracteres, mayuscula, minuscula, numero y simbolo; sin comas, comillas ni espacios)' -AsSecureString
$plain = [System.Net.NetworkCredential]::new('', $secure).Password
if ($plain.Length -lt 12) { throw 'La contrasena debe tener 12 o mas caracteres.' }
if ($plain -match '[,"''\s]') { throw 'La contrasena no puede tener comas, comillas ni espacios.' }

# 1) Crear (si no existe) y fijar contrasena permanente
$null = & aws cognito-idp admin-get-user --user-pool-id $Pool --username $Email --region $Region --profile $ProfileName 2>&1
if ($LASTEXITCODE -ne 0) {
  Invoke-Aws cognito-idp admin-create-user --user-pool-id $Pool --username $Email --user-attributes "Name=email,Value=$Email" "Name=email_verified,Value=true" --message-action SUPPRESS | Out-Null
  Write-Host "Usuario creado: $Email"
} else {
  Write-Host "El usuario ya existia; se continua con el mismo."
}
Invoke-Aws cognito-idp admin-set-user-password --user-pool-id $Pool --username $Email --password $plain --permanent | Out-Null

# 2) Privilegiados: enrolar TOTP antes de asignar el grupo
if ($SkipMfa -and $Group -ne 'DONANTE') {
  Write-Warning 'Se omite el enrolamiento TOTP: usar SOLO para la prueba T14 (gestor sin segundo factor).'
}
if ($Group -ne 'DONANTE' -and -not $SkipMfa) {
  $auth = (Invoke-Aws cognito-idp admin-initiate-auth --user-pool-id $Pool --client-id $AdminClient --auth-flow ADMIN_USER_PASSWORD_AUTH --auth-parameters "USERNAME=$Email,PASSWORD=$plain" | Out-String) | ConvertFrom-Json
  $access = $auth.AuthenticationResult.AccessToken
  if (-not $access) { throw 'No se obtuvo access token (el usuario ya tiene MFA configurado o la contrasena es incorrecta).' }

  $assoc = (Invoke-Aws cognito-idp associate-software-token --access-token $access | Out-String) | ConvertFrom-Json
  Write-Host ''
  Write-Host '=== Escribe este secreto en tu app autenticadora (entrada manual de clave) ===' -ForegroundColor Yellow
  Write-Host "Secreto TOTP: $($assoc.SecretCode)"
  Write-Host 'NO captures esta pantalla ni guardes el secreto.' -ForegroundColor Red
  Write-Host ''
  $code = Read-Host 'Codigo de 6 digitos que muestra la app'
  Invoke-Aws cognito-idp verify-software-token --access-token $access --user-code $code --friendly-device-name $Email | Out-Null
  Invoke-Aws cognito-idp admin-set-user-mfa-preference --user-pool-id $Pool --username $Email --software-token-mfa-settings 'Enabled=true,PreferredMfa=true' | Out-Null
  Write-Host 'TOTP activado como metodo preferido.'
  Clear-Host
}

# 3) Asignar el grupo
Invoke-Aws cognito-idp admin-add-user-to-group --user-pool-id $Pool --username $Email --group-name $Group | Out-Null
Write-Host "Usuario $Email agregado al grupo $Group."

# 4) Resumen sin secretos
Invoke-Aws cognito-idp admin-get-user --user-pool-id $Pool --username $Email --query '{estado:UserStatus,mfa:UserMFASettingList,preferido:PreferredMfaSetting}' --output json
Invoke-Aws cognito-idp admin-list-groups-for-user --user-pool-id $Pool --username $Email --query 'Groups[].GroupName' --output json
