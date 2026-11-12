[CmdletBinding()]
param(
    [string]$IntegrationRoot,
    [string]$EnvFile,
    [string]$ExpectedDatabase,
    [string]$BackupDirectory = 'C:\shared-planner-private\backups',
    [string]$PostgresBin = (Join-Path $env:USERPROFILE 'postgres-local\pgsql\bin')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if (-not $IntegrationRoot) { $IntegrationRoot = Split-Path -Parent $PSScriptRoot }
$integration = (Resolve-Path -LiteralPath $IntegrationRoot).Path
$destination = [IO.Path]::GetFullPath($BackupDirectory)
foreach ($repository in @($integration, (Join-Path (Split-Path $integration -Parent) 'shared-planner-backend'), (Join-Path (Split-Path $integration -Parent) 'shared-planner-frontend'))) {
    if ($destination.StartsWith($repository + '\', [StringComparison]::OrdinalIgnoreCase) -or $destination -eq $repository) {
        throw 'Backups privados devem ficar fora dos repositorios Git.'
    }
}
$configuration = @{}
if (-not $EnvFile) { $EnvFile = Join-Path $integration '.env' }
foreach ($line in Get-Content -LiteralPath $EnvFile -Encoding UTF8) {
    if ($line -match '^\s*([A-Z0-9_]+)=(.*)$') {
        $configuration[$matches[1]] = $matches[2].Trim().Trim('"').Trim("'")
    }
}
if ($configuration.ContainsKey('SPRING_DATASOURCE_URL')) {
    if ($configuration['SPRING_DATASOURCE_URL'] -notmatch '^jdbc:postgresql://(?:localhost|127\.0\.0\.1):([0-9]+)/([A-Za-z0-9_]+)$') {
        throw 'O arquivo runtime deve apontar explicitamente para PostgreSQL local.'
    }
    $configuration['POSTGRES_PORT']=$matches[1]
    $configuration['POSTGRES_DB']=$matches[2]
    $configuration['POSTGRES_USER']=$configuration['SPRING_DATASOURCE_USERNAME']
    $configuration['POSTGRES_PASSWORD']=$configuration['SPRING_DATASOURCE_PASSWORD']
}
foreach ($name in @('POSTGRES_DB','POSTGRES_USER','POSTGRES_PASSWORD')) {
    if (-not $configuration.ContainsKey($name) -or -not $configuration[$name]) { throw "Configuracao local ausente: $name" }
}
$database = $configuration['POSTGRES_DB']
if ($ExpectedDatabase) {
    if ($database -ne $ExpectedDatabase) { throw 'O banco configurado diverge do banco local confirmado.' }
} elseif ($database -notmatch '(?i)(dev|local|test)') {
    throw 'Confirme o nome do banco local com -ExpectedDatabase antes de executar.'
}
$port = if ($configuration.ContainsKey('POSTGRES_PORT')) { $configuration['POSTGRES_PORT'] } else { '5432' }
New-Item -ItemType Directory -Path $destination -Force | Out-Null
$stamp = Get-Date -Format 'yyyyMMddTHHmmss'
$backup = Join-Path $destination "shared-planner-before-calendar-import-$stamp.dump"
if (Test-Path -LiteralPath $backup) { throw 'Backup existente nao sera sobrescrito.' }
$oldPassword = [Environment]::GetEnvironmentVariable('PGPASSWORD', 'Process')
try {
    $env:PGPASSWORD = $configuration['POSTGRES_PASSWORD']
    $connection = @('-w','-h','127.0.0.1','-p',$port,'-U',$configuration['POSTGRES_USER'],'-d',$database)
    $before = & (Join-Path $PostgresBin 'psql.exe') @connection -At -v ON_ERROR_STOP=1 -c "select json_build_object('database',current_database(),'users',(select count(*) from users),'calendars',(select count(*) from calendars),'members',(select count(*) from calendar_members),'events',(select count(*) from events),'auditLogs',(select count(*) from audit_logs),'flywayVersion',(select max(version::integer) from flyway_schema_history where success));"
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao inspecionar o banco local; nada alterado.' }
    & (Join-Path $PostgresBin 'pg_dump.exe') @connection --format=custom --no-owner --no-acl --file=$backup
    if ($LASTEXITCODE -ne 0) { throw 'pg_dump falhou; nao aplicar migrations.' }
    $catalog = @(& (Join-Path $PostgresBin 'pg_restore.exe') --list $backup)
    if ($LASTEXITCODE -ne 0 -or $catalog.Count -eq 0) { throw 'Catalogo do backup nao pode ser lido.' }
    $metadata = [ordered]@{ CreatedAt=(Get-Date).ToString('o'); Backup=$backup; SHA256=(Get-FileHash -LiteralPath $backup -Algorithm SHA256).Hash; Bytes=(Get-Item -LiteralPath $backup).Length; CatalogEntries=$catalog.Count; Baseline=($before | ConvertFrom-Json) }
    $metadata | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath ($backup + '.json') -Encoding UTF8
    [pscustomobject]@{ Backup=$backup; Bytes=$metadata.Bytes; CatalogEntries=$catalog.Count; Baseline=$metadata.Baseline } | ConvertTo-Json -Depth 4
} finally {
    [Environment]::SetEnvironmentVariable('PGPASSWORD', $oldPassword, 'Process')
}
