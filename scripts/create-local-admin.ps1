<#
.SYNOPSIS
  Cria (ou reativa) um ADMIN global e um calendario inicial no PostgreSQL local de desenvolvimento.

.DESCRIPTION
  Necessario quando o banco esta vazio: a API nao possui cadastro publico, entao o primeiro ADMIN
  precisa ser criado direto no banco. O schema continua sendo responsabilidade do Flyway; este script
  so insere dados e exige que as migrations ja tenham sido aplicadas (suba o backend uma vez antes).

  - Le POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_PORT / POSTGRES_DB do .env da raiz do monorepo.
  - Senha do admin: informe -Password ou deixe vazio para gerar uma senha aleatoria.
  - A senha NUNCA e impressa: e gravada em $env:USERPROFILE\postgres-local\admin-credentials.txt
    (fora do repositorio). O hash e BCrypt ($2a$, custo 10), compativel com BCryptPasswordEncoder.
  - Idempotente: se o e-mail ja existe, redefine a senha, mantem ADMIN e reativa o usuario.

.EXAMPLE
  .\scripts\create-local-admin.ps1
  .\scripts\create-local-admin.ps1 -Email voce@exemplo.com -FullName "Seu Nome"
#>
[CmdletBinding()]
param(
  [string]$Email = 'admin@sharedplanner.local',
  [string]$FullName = 'Administrador',
  [string]$CalendarName = 'Agenda Principal',
  [string]$Password,
  [string]$EnvFile
)

$ErrorActionPreference = 'Stop'

if (-not $EnvFile) {
  $EnvFile = Join-Path (Split-Path -Parent $PSScriptRoot) '.env'
}
if (-not (Test-Path $EnvFile)) { throw ".env nao encontrado em $EnvFile (copie de .env.example)." }

function Read-EnvValue([string]$Key, [string]$Default = $null) {
  $line = Select-String -Path $EnvFile -Pattern "^\s*$Key=(.*)$" | Select-Object -First 1
  if ($line) { return $line.Matches[0].Groups[1].Value.Trim() }
  return $Default
}

$db   = Read-EnvValue 'POSTGRES_DB' 'shared_planner'
$user = Read-EnvValue 'POSTGRES_USER' 'shared_planner'
$pass = Read-EnvValue 'POSTGRES_PASSWORD'
$port = Read-EnvValue 'POSTGRES_PORT' '5432'
if (-not $pass) { throw 'POSTGRES_PASSWORD vazio no .env.' }

$psql = Join-Path $env:USERPROFILE 'postgres-local\pgsql\bin\psql.exe'
if (-not (Test-Path $psql)) {
  $found = Get-Command psql -ErrorAction SilentlyContinue
  if (-not $found) { throw 'psql nao encontrado. Rode antes .\scripts\start-local-postgres.ps1' }
  $psql = $found.Source
}

if ([string]::IsNullOrWhiteSpace($Password)) {
  $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  $bytes = New-Object byte[] 20
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $Password = -join ($bytes | ForEach-Object { $alphabet[$_ % $alphabet.Length] })
}
if ($Password.Length -lt 6) { throw 'A senha precisa ter pelo menos 6 caracteres.' }

$normalizedEmail = $Email.Trim().ToLowerInvariant()

# Valores entram como variaveis do psql (:'nome'), nunca concatenados no SQL.
$sql = @'
\set ON_ERROR_STOP on
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM flyway_schema_history WHERE success AND version = '7') THEN
    RAISE EXCEPTION 'Migrations Flyway ate V7 nao aplicadas; suba o backend uma vez antes.';
  END IF;
END $$;

INSERT INTO users (full_name, email, password_hash, role, active, created_at)
SELECT :'full_name', :'email', crypt(:'pw', gen_salt('bf', 10)), 'ADMIN', TRUE, now() AT TIME ZONE 'UTC'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE lower(email) = :'email');

UPDATE users
   SET password_hash = crypt(:'pw', gen_salt('bf', 10)), role = 'ADMIN', active = TRUE,
       updated_at = now() AT TIME ZONE 'UTC'
 WHERE lower(email) = :'email';

INSERT INTO calendars (name, owner_user_id, created_by_user_id, created_at)
SELECT :'calendar_name', u.id, u.id, now() AT TIME ZONE 'UTC'
  FROM users u
 WHERE lower(u.email) = :'email'
   AND NOT EXISTS (SELECT 1 FROM calendars c WHERE c.owner_user_id = u.id AND c.name = :'calendar_name');

INSERT INTO calendar_members (calendar_id, user_id, member_role, created_by_user_id, created_at)
SELECT c.id, u.id, 'ADMIN', u.id, now() AT TIME ZONE 'UTC'
  FROM users u JOIN calendars c ON c.owner_user_id = u.id AND c.name = :'calendar_name'
 WHERE lower(u.email) = :'email'
ON CONFLICT (calendar_id, user_id) DO UPDATE SET member_role = 'ADMIN';

DROP EXTENSION IF EXISTS pgcrypto;
COMMIT;

SELECT 'admin=' || u.email || ' role=' || u.role || ' active=' || u.active
       || ' bcrypt=' || (left(u.password_hash, 4) = '$2a$')
  FROM users u WHERE lower(u.email) = :'email';
SELECT 'calendario=' || c.name || ' papel=' || m.member_role
  FROM calendars c JOIN calendar_members m ON m.calendar_id = c.id
  JOIN users u ON u.id = m.user_id
 WHERE lower(u.email) = :'email' AND c.name = :'calendar_name';
'@

$env:PGPASSWORD = $pass
try {
  $sql | & $psql -h 127.0.0.1 -p $port -U $user -d $db -tA -q `
      -v "email=$normalizedEmail" -v "full_name=$FullName" -v "pw=$Password" -v "calendar_name=$CalendarName"
  if ($LASTEXITCODE -ne 0) { throw "psql falhou (exit $LASTEXITCODE)." }
} finally {
  Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}

$credentialsFile = Join-Path $env:USERPROFILE 'postgres-local\admin-credentials.txt'
@(
  "# Credencial local do Shared Planner (nao versionar). Gerada em $(Get-Date -Format s)."
  "email=$normalizedEmail"
  "password=$Password"
) | Set-Content -Path $credentialsFile -Encoding ascii

Write-Host "OK: ADMIN '$normalizedEmail' pronto; calendario '$CalendarName' criado."
Write-Host "Senha gravada em: $credentialsFile (nao foi exibida)."
