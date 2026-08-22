[CmdletBinding()]
param(
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
    param(
        [Parameter(Mandatory)] [string]$RelativePath
    )

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
    param(
        [Parameter(Mandatory)] [string]$Root
    )

    if (-not (Test-Path -LiteralPath $Root -PathType Container)) {
        throw "Diretorio nao encontrado: $Root"
    }

    $resolvedRoot = (Resolve-Path -LiteralPath $Root).Path.TrimEnd('\', '/')
    $manifest = @{}

    Get-ChildItem -LiteralPath $resolvedRoot -File -Recurse -Force | ForEach-Object {
        $relativePath = $_.FullName.Substring($resolvedRoot.Length + 1).Replace('\', '/')
        if (-not (Test-ExcludedPath -RelativePath $relativePath)) {
            $manifest[$relativePath] = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash
        }
    }

    return $manifest
}

function Compare-RepositoryPair {
    param(
        [Parameter(Mandatory)] [string]$Name,
        [Parameter(Mandatory)] [string]$MonorepoPath,
        [Parameter(Mandatory)] [string]$StandalonePath
    )

    if (-not (Test-Path -LiteralPath (Join-Path $StandalonePath '.git'))) {
        throw "O destino standalone nao possui .git proprio na raiz: $StandalonePath"
    }

    $source = Get-TreeManifest -Root $MonorepoPath
    $destination = Get-TreeManifest -Root $StandalonePath
    $differences = [System.Collections.Generic.List[object]]::new()
    $allPaths = @($source.Keys) + @($destination.Keys) | Sort-Object -Unique

    foreach ($path in $allPaths) {
        if (-not $source.ContainsKey($path)) {
            $differences.Add([pscustomobject]@{ Status = 'ONLY_STANDALONE'; Path = $path })
        }
        elseif (-not $destination.ContainsKey($path)) {
            $differences.Add([pscustomobject]@{ Status = 'MISSING_STANDALONE'; Path = $path })
        }
        elseif ($source[$path] -ne $destination[$path]) {
            $differences.Add([pscustomobject]@{ Status = 'CONTENT_DIFFERS'; Path = $path })
        }
    }

    Write-Host "[$Name] monorepo=$($source.Count) standalone=$($destination.Count)"
    if ($differences.Count -eq 0) {
        Write-Host "[$Name] PASS - repositorios equivalentes."
    }
    else {
        Write-Host "[$Name] FAIL - $($differences.Count) divergencia(s):"
        $differences | ForEach-Object { Write-Host "  $($_.Status) $($_.Path)" }
    }

    return $differences.Count
}

try {
    $topology = Assert-RepositoryTopology `
        -Integration $IntegrationRoot `
        -Backend $BackendRepository `
        -Frontend $FrontendRepository
    $backendDifferences = Compare-RepositoryPair `
        -Name 'BACKEND' `
        -MonorepoPath $topology.BackendSource `
        -StandalonePath $topology.BackendRoot
    $frontendDifferences = Compare-RepositoryPair `
        -Name 'FRONTEND' `
        -MonorepoPath $topology.FrontendSource `
        -StandalonePath $topology.FrontendRoot

    if (($backendDifferences + $frontendDifferences) -gt 0) {
        exit 1
    }

    Write-Output 'REPOSITORY_SYNC PASS'
    exit 0
}
catch {
    Write-Error $_ -ErrorAction Continue
    exit 2
}
