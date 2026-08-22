[CmdletBinding()]
param(
    [switch]$Apply,
    [string]$IntegrationRoot,
    [string]$BackendRepository,
    [string]$FrontendRepository
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not $IntegrationRoot) {
    $IntegrationRoot = Split-Path -Parent $PSScriptRoot
}

if (-not $BackendRepository) {
    $BackendRepository = Join-Path (Split-Path -Parent $IntegrationRoot) 'shared-planner-backend'
}

if (-not $FrontendRepository) {
    $FrontendRepository = Join-Path (Split-Path -Parent $IntegrationRoot) 'shared-planner-frontend'
}

$excludedDirectories = @(
    '.git', 'target', 'node_modules', 'dist', '.angular', '.idea', '.vscode', 'logs'
)

function Get-CanonicalRoot {
    param([Parameter(Mandatory)] [string]$Path)

    if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
        throw "Diretorio nao encontrado: $Path"
    }

    return (Resolve-Path -LiteralPath $Path).Path.TrimEnd('\', '/')
}

function Test-PathOverlap {
    param(
        [Parameter(Mandatory)] [string]$First,
        [Parameter(Mandatory)] [string]$Second
    )

    if ($First.Equals($Second, [System.StringComparison]::OrdinalIgnoreCase)) {
        return $true
    }

    $separator = [System.IO.Path]::DirectorySeparatorChar
    return $First.StartsWith($Second + $separator, [System.StringComparison]::OrdinalIgnoreCase) `
        -or $Second.StartsWith($First + $separator, [System.StringComparison]::OrdinalIgnoreCase)
}

function Assert-SingleRootGit {
    param([Parameter(Mandatory)] [string]$Root)

    $expectedGit = Join-Path $Root '.git'
    $gitMetadata = @(
        Get-ChildItem -LiteralPath $Root -Force -Recurse -ErrorAction Stop |
            Where-Object { $_.Name -eq '.git' } |
            ForEach-Object { $_.FullName.TrimEnd('\', '/') }
    )

    if ($gitMetadata.Count -ne 1 -or
        -not $gitMetadata[0].Equals($expectedGit, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Topologia Git invalida em $Root. Esperado apenas: $expectedGit"
    }
}

function Assert-RepositoryTopology {
    param(
        [Parameter(Mandatory)] [string]$Integration,
        [Parameter(Mandatory)] [string]$Backend,
        [Parameter(Mandatory)] [string]$Frontend
    )

    $integrationRoot = Get-CanonicalRoot -Path $Integration
    $backendRoot = Get-CanonicalRoot -Path $Backend
    $frontendRoot = Get-CanonicalRoot -Path $Frontend
    $roots = @($integrationRoot, $backendRoot, $frontendRoot)

    for ($i = 0; $i -lt $roots.Count; $i++) {
        for ($j = $i + 1; $j -lt $roots.Count; $j++) {
            if (Test-PathOverlap -First $roots[$i] -Second $roots[$j]) {
                throw "Roots recusados por sobreposicao: $($roots[$i]) <-> $($roots[$j])"
            }
        }
    }

    $backendSource = Join-Path $integrationRoot 'backend'
    $frontendSource = Join-Path $integrationRoot 'frontend'
    $requiredPaths = @(
        (Join-Path $integrationRoot '.git'),
        (Join-Path $integrationRoot 'compose.yaml'),
        (Join-Path $backendSource 'pom.xml'),
        (Join-Path $frontendSource 'package.json'),
        (Join-Path $backendRoot 'pom.xml'),
        (Join-Path $backendRoot 'src'),
        (Join-Path $frontendRoot 'package.json'),
        (Join-Path $frontendRoot 'src')
    )
    foreach ($requiredPath in $requiredPaths) {
        if (-not (Test-Path -LiteralPath $requiredPath)) {
            throw "Topologia inesperada; item obrigatorio ausente: $requiredPath"
        }
    }

    if (Test-Path -LiteralPath (Join-Path $backendRoot 'backend')) {
        throw "Backend standalone nao pode conter modulo backend aninhado: $backendRoot"
    }
    if (Test-Path -LiteralPath (Join-Path $frontendRoot 'frontend')) {
        throw "Frontend standalone nao pode conter modulo frontend aninhado: $frontendRoot"
    }

    Assert-SingleRootGit -Root $integrationRoot
    Assert-SingleRootGit -Root $backendRoot
    Assert-SingleRootGit -Root $frontendRoot

    return @{
        IntegrationRoot = $integrationRoot
        BackendRoot = $backendRoot
        FrontendRoot = $frontendRoot
        BackendSource = $backendSource
        FrontendSource = $frontendSource
    }
}

function Test-ExcludedPath {
    param([Parameter(Mandatory)] [string]$RelativePath)

    $parts = $RelativePath -split '[\\/]'
    foreach ($part in $parts) {
        if ($excludedDirectories -contains $part) {
            return $true
        }
    }

    $leaf = $parts[-1]
    if ($leaf -like '*.log' -or $leaf -eq '.env') {
        return $true
    }

    if ($leaf -like '.env.*' -and $leaf -ne '.env.example') {
        return $true
    }

    return $false
}

function Get-TreeManifest {
    param([Parameter(Mandatory)] [string]$Root)

    if (-not (Test-Path -LiteralPath $Root -PathType Container)) {
        throw "Diretorio nao encontrado: $Root"
    }

    $resolvedRoot = (Resolve-Path -LiteralPath $Root).Path.TrimEnd('\', '/')
    $manifest = @{}
    Get-ChildItem -LiteralPath $resolvedRoot -File -Recurse -Force | ForEach-Object {
        $relativePath = $_.FullName.Substring($resolvedRoot.Length + 1).Replace('\', '/')
        if (-not (Test-ExcludedPath -RelativePath $relativePath)) {
            $manifest[$relativePath] = [pscustomobject]@{
                FullName = $_.FullName
                Hash = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash
            }
        }
    }
    return $manifest
}

function Sync-RepositoryPair {
    param(
        [Parameter(Mandatory)] [string]$Name,
        [Parameter(Mandatory)] [string]$SourceRoot,
        [Parameter(Mandatory)] [string]$DestinationRoot
    )

    if (-not (Test-Path -LiteralPath (Join-Path $DestinationRoot '.git'))) {
        throw "Sincronizacao recusada: o destino nao possui .git proprio na raiz: $DestinationRoot"
    }

    $resolvedSource = (Resolve-Path -LiteralPath $SourceRoot).Path.TrimEnd('\', '/')
    $resolvedDestination = (Resolve-Path -LiteralPath $DestinationRoot).Path.TrimEnd('\', '/')
    if ($resolvedSource -eq $resolvedDestination) {
        throw "Sincronizacao recusada: origem e destino sao iguais."
    }

    $source = Get-TreeManifest -Root $resolvedSource
    $destination = Get-TreeManifest -Root $resolvedDestination
    $operations = [System.Collections.Generic.List[object]]::new()

    foreach ($path in ($source.Keys | Sort-Object)) {
        if (-not $destination.ContainsKey($path)) {
            $operations.Add([pscustomobject]@{ Action = 'ADD'; Path = $path })
        }
        elseif ($source[$path].Hash -ne $destination[$path].Hash) {
            $operations.Add([pscustomobject]@{ Action = 'UPDATE'; Path = $path })
        }
    }

    foreach ($path in ($destination.Keys | Sort-Object)) {
        if (-not $source.ContainsKey($path)) {
            $operations.Add([pscustomobject]@{ Action = 'KEEP_DESTINATION_ONLY'; Path = $path })
        }
    }

    Write-Output "[$Name] modo=$(if ($Apply) { 'APPLY' } else { 'PREVIEW' })"
    if ($operations.Count -eq 0) {
        Write-Output "[$Name] nenhuma alteracao necessaria."
        return
    }

    $operations | ForEach-Object { Write-Output "  $($_.Action) $($_.Path)" }

    if (-not $Apply) {
        Write-Output "[$Name] preview concluido; nenhum arquivo foi alterado."
        return
    }

    foreach ($operation in $operations) {
        if ($operation.Action -eq 'KEEP_DESTINATION_ONLY') {
            continue
        }

        $sourceFile = Join-Path $resolvedSource ($operation.Path.Replace('/', '\'))
        $destinationFile = Join-Path $resolvedDestination ($operation.Path.Replace('/', '\'))
        $destinationDirectory = Split-Path -Parent $destinationFile
        if (-not (Test-Path -LiteralPath $destinationDirectory)) {
            New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
        }
        Copy-Item -LiteralPath $sourceFile -Destination $destinationFile -Force
    }

    Write-Output "[$Name] copia concluida sem exclusoes."
}

try {
    $topology = Assert-RepositoryTopology `
        -Integration $IntegrationRoot `
        -Backend $BackendRepository `
        -Frontend $FrontendRepository
    Sync-RepositoryPair `
        -Name 'BACKEND' `
        -SourceRoot $topology.BackendSource `
        -DestinationRoot $topology.BackendRoot
    Sync-RepositoryPair `
        -Name 'FRONTEND' `
        -SourceRoot $topology.FrontendSource `
        -DestinationRoot $topology.FrontendRoot

    if (-not $Apply) {
        Write-Output 'PREVIEW_ONLY - execute novamente com -Apply para copiar ADD/UPDATE.'
        exit 0
    }

    & (Join-Path $PSScriptRoot 'check-repository-sync.ps1') `
        -IntegrationRoot $IntegrationRoot `
        -BackendRepository $BackendRepository `
        -FrontendRepository $FrontendRepository
    exit $LASTEXITCODE
}
catch {
    Write-Error $_ -ErrorAction Continue
    exit 2
}
