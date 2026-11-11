<#
.SYNOPSIS
  Sobe um PostgreSQL 17.11 portatil (sem Docker e sem admin) para desenvolvimento local.

.DESCRIPTION
  Alternativa ao `docker compose up -d postgres` quando o Docker nao esta disponivel.
  Le POSTGRES_DB / POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_PORT do .env da raiz do monorepo,
  baixa os binarios oficiais da EDB (uma vez), inicializa o cluster (uma vez) e inicia o servidor
  em 127.0.0.1. Idempotente: pode ser executado varias vezes.

  Dados e binarios ficam em $env:USERPROFILE\postgres-local (fora do repositorio).
  Para parar:  & "$env:USERPROFILE\postgres-local\pgsql\bin\pg_ctl.exe" stop -D "$env:USERPROFILE\postgres-local\data"
#>
[CmdletBinding()]
param(
  [string]$EnvFile,
  [string]$Version = '17.11-1'
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

if (-not $EnvFile) {
  $scriptDir = if ($PSScriptRoot) { $PSScriptRoot }
               elseif ($MyInvocation.MyCommand.Path) { Split-Path -Parent $MyInvocation.MyCommand.Path }
               else { (Get-Location).Path }
  $EnvFile = Join-Path (Split-Path -Parent $scriptDir) '.env'
  if (-not (Test-Path $EnvFile)) { $EnvFile = Join-Path $scriptDir '.env' }
}

function Read-EnvValue([string]$Key, [string]$Default = $null) {
  $line = Select-String -Path $EnvFile -Pattern "^\s*$Key=(.*)$" | Select-Object -First 1
  if ($line) { return $line.Matches[0].Groups[1].Value.Trim() }
  return $Default
}

if (-not (Test-Path $EnvFile)) { throw ".env nao encontrado em $EnvFile (copie de .env.example)." }

$db   = Read-EnvValue 'POSTGRES_DB' 'shared_planner'
$user = Read-EnvValue 'POSTGRES_USER' 'shared_planner'
$pass = Read-EnvValue 'POSTGRES_PASSWORD'
$port = Read-EnvValue 'POSTGRES_PORT' '5432'
if (-not $pass) { throw 'POSTGRES_PASSWORD vazio no .env.' }

$base = Join-Path $env:USERPROFILE 'postgres-local'
$bin  = Join-Path $base 'pgsql\bin'
$data = Join-Path $base 'data'
$log  = Join-Path $base 'postgres.log'
New-Item -ItemType Directory -Force $base | Out-Null

if (-not (Test-Path (Join-Path $bin 'pg_ctl.exe'))) {
  $zip = Join-Path $base 'postgresql-binaries.zip'
  $url = "https://get.enterprisedb.com/postgresql/postgresql-$Version-windows-x64-binaries.zip"
  Write-Host "Baixando $url ..."
  Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
  Write-Host 'Extraindo ...'
  Expand-Archive -Path $zip -DestinationPath $base -Force
  Remove-Item $zip -Force
}

if (-not (Test-Path (Join-Path $data 'PG_VERSION'))) {
  Write-Host 'Inicializando cluster ...'
  $pwFile = Join-Path $base 'pw.tmp'
  Set-Content -Path $pwFile -Value $pass -NoNewline -Encoding ascii
  try {
    & (Join-Path $bin 'initdb.exe') -D $data -U $user --pwfile=$pwFile -A scram-sha-256 -E UTF8 --locale=C
    if ($LASTEXITCODE -ne 0) { throw 'initdb falhou.' }
  } finally { Remove-Item $pwFile -Force -ErrorAction SilentlyContinue }
}

& (Join-Path $bin 'pg_ctl.exe') status -D $data *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Iniciando PostgreSQL na porta $port (processo desacoplado deste terminal) ..."
  # Start-Process com janela oculta: o servidor ganha console proprio e nao morre
  # quando este terminal/IDE e fechado.
  $pgArgs = @('start', '-D', "`"$data`"", '-l', "`"$log`"", '-w', '-o', "`"-p $port -c listen_addresses=127.0.0.1 -c timezone=UTC`"")
  $proc = Start-Process -FilePath (Join-Path $bin 'pg_ctl.exe') -ArgumentList $pgArgs -WindowStyle Hidden -PassThru
  # Espera apenas o pg_ctl (nao o postgres filho, que deve continuar rodando).
  $proc.WaitForExit()
  if ($proc.ExitCode -ne 0) { throw "pg_ctl start falhou (exit $($proc.ExitCode)). Veja $log" }
} else {
  Write-Host 'PostgreSQL ja esta em execucao.'
}

$env:PGPASSWORD = $pass
try {
  $exists = & (Join-Path $bin 'psql.exe') -h 127.0.0.1 -p $port -U $user -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$db'"
  if (-not $exists) {
    & (Join-Path $bin 'createdb.exe') -h 127.0.0.1 -p $port -U $user $db
    if ($LASTEXITCODE -ne 0) { throw 'createdb falhou.' }
    Write-Host "Banco '$db' criado."
  } else {
    Write-Host "Banco '$db' ja existe."
  }
} finally { Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue }

Write-Host "OK: PostgreSQL pronto em 127.0.0.1:$port (db=$db, user=$user)."
