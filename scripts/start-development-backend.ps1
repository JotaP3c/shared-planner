[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$RuntimeEnvFile,
    [int]$Port = 8080,
    [string]$LogDirectory = 'C:\shared-planner-private\runtime-logs'
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$backendRoot=Join-Path (Split-Path -Parent $PSScriptRoot) 'backend'
$jar=Get-ChildItem -LiteralPath (Join-Path $backendRoot 'target') -Filter 'shared-planner-api-*.jar' |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
if(-not $jar){ throw 'Execute mvnw.cmd package antes de iniciar.' }
foreach($line in Get-Content -LiteralPath $RuntimeEnvFile -Encoding UTF8){
    if($line -match '^\s*([A-Z0-9_]+)=(.*)$'){
        [Environment]::SetEnvironmentVariable($matches[1],$matches[2].Trim().Trim('"').Trim("'"),'Process')
    }
}
if($env:SPRING_DATASOURCE_URL -notmatch '^jdbc:postgresql://(?:localhost|127\.0\.0\.1):\d+/'){
    throw 'Este runner e exclusivo do PostgreSQL local de desenvolvimento.'
}
$env:SPRING_PROFILES_ACTIVE='dev'
$env:SERVER_ADDRESS='127.0.0.1'
$env:SERVER_PORT=[string]$Port
$env:SPRING_JPA_SHOW_SQL='false'
$env:SPRING_JPA_PROPERTIES_HIBERNATE_FORMAT_SQL='false'
$env:LOGGING_LEVEL_ROOT='WARN'
$env:DEBUG='false'
New-Item -ItemType Directory -Path $LogDirectory -Force | Out-Null
$stamp=Get-Date -Format yyyyMMddTHHmmss
$process=Start-Process -FilePath (Get-Command java.exe).Source -ArgumentList @('-jar',$jar.FullName) -WorkingDirectory $backendRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $LogDirectory "backend-$stamp.out.log") -RedirectStandardError (Join-Path $LogDirectory "backend-$stamp.err.log")
[pscustomobject]@{PID=$process.Id;Port=$Port;Jar=$jar.FullName;LogDirectory=$LogDirectory} | ConvertTo-Json -Compress
