<#
.SYNOPSIS
  Regenerate PROJECT_MAP.md without full release

.EXAMPLE
  .\scripts\context.ps1
  npm run context
#>

param()

$ErrorActionPreference = "Stop"

if (-not (Test-Path "package.json") -or -not (Test-Path "src")) {
    Write-Host "Run from project root" -ForegroundColor Red
    exit 1
}

# Read version
$version = "unknown"
$pkg = Get-Content "package.json" -Raw -Encoding UTF8
if ($pkg -match '"version"\s*:\s*"(\d+\.\d+\.\d+)"') {
    $version = [string]$Matches[1]
}

# Import module
. "$PSScriptRoot\project-map.ps1"

Write-Host ""
Write-Host "> Generating PROJECT_MAP.md (version $version)..." -ForegroundColor Cyan

try {
    $path = Generate-ProjectMap -Version $version
    $sizeKB = [math]::Round((Get-Item $path).Length / 1KB, 1)
    Write-Host "  [OK]   $path" -ForegroundColor Green
    Write-Host "  [OK]   $sizeKB KB" -ForegroundColor Green
}
catch {
    Write-Host "  [ERR]  $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Open: code PROJECT_MAP.md" -ForegroundColor DarkGray
Write-Host ""