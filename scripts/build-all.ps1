# =================================================================
# NEBULA BUILD ALL - PC (Windows) + Android
# =================================================================

$ErrorActionPreference = "Stop"
$startTime = Get-Date

# Java 21 for Android
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"

Write-Host ""
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  NEBULA BUILD ALL - Windows + Android" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path "package.json")) {
    Write-Host "[ERROR] Run from project root (where package.json is)" -ForegroundColor Red
    exit 1
}

# ===== 1. PC RELEASE =====
Write-Host "[1/2] PC build (release)..." -ForegroundColor Yellow
Write-Host "      First time 5-15 min, then ~1 min." -ForegroundColor DarkGray
Write-Host ""

$pcStart = Get-Date
npm run pc:build
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] PC build failed!" -ForegroundColor Red
    exit 1
}
$pcTime = [math]::Round(((Get-Date) - $pcStart).TotalSeconds, 0)
Write-Host ""
Write-Host "[OK] PC done in $pcTime sec." -ForegroundColor Green
Write-Host ""

# ===== 2. ANDROID RELEASE =====
Write-Host "[2/2] Android (release APK)..." -ForegroundColor Yellow
Write-Host "      2-3 minutes." -ForegroundColor DarkGray
Write-Host ""

$androidStart = Get-Date

npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "[ERROR] npm build failed" -ForegroundColor Red; exit 1 }

npx cap sync android
if ($LASTEXITCODE -ne 0) { Write-Host "[ERROR] cap sync failed" -ForegroundColor Red; exit 1 }

Push-Location android
.\gradlew.bat --stop 2>&1 | Out-Null
.\gradlew.bat assembleRelease
$androidExit = $LASTEXITCODE
Pop-Location

if ($androidExit -ne 0) {
    Write-Host "[ERROR] Android build failed!" -ForegroundColor Red
    exit 1
}
$androidTime = [math]::Round(((Get-Date) - $androidStart).TotalSeconds, 0)
Write-Host ""
Write-Host "[OK] Android done in $androidTime sec." -ForegroundColor Green
Write-Host ""

# ===== 3. COLLECT ARTIFACTS =====
Write-Host "Collecting artifacts into dist_release/..." -ForegroundColor Cyan

$outDir = "dist_release"
if (Test-Path $outDir) { Remove-Item $outDir -Recurse -Force }
New-Item -ItemType Directory -Path $outDir | Out-Null

# PC MSI
$msi = Get-ChildItem "src-tauri\target\release\bundle\msi\*.msi" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($msi) {
    Copy-Item $msi.FullName "$outDir\NEBULA-2.0.0-x64.msi"
    Write-Host "  [OK] NEBULA-2.0.0-x64.msi" -ForegroundColor Gray
}

# PC NSIS installer
$nsis = Get-ChildItem "src-tauri\target\release\bundle\nsis\*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($nsis) {
    Copy-Item $nsis.FullName "$outDir\NEBULA-2.0.0-Setup.exe"
    Write-Host "  [OK] NEBULA-2.0.0-Setup.exe" -ForegroundColor Gray
}

# PC portable
$portable = "src-tauri\target\release\nebula.exe"
if (Test-Path $portable) {
    Copy-Item $portable "$outDir\NEBULA-2.0.0-Portable.exe"
    Write-Host "  [OK] NEBULA-2.0.0-Portable.exe" -ForegroundColor Gray
}

# Android APK
$apk = "android\app\build\outputs\apk\release\app-release.apk"
if (Test-Path $apk) {
    Copy-Item $apk "$outDir\NEBULA-2.0.0.apk"
    Write-Host "  [OK] NEBULA-2.0.0.apk" -ForegroundColor Gray
}

# README (ASCII only to avoid encoding issues)
$readme = @'
# NEBULA Oracle Terminal v2.0.0

## What is inside

| File | Purpose |
|------|---------|
| NEBULA-2.0.0-Setup.exe    | Windows installer (recommended) |
| NEBULA-2.0.0-Portable.exe | Portable version (no install) |
| NEBULA-2.0.0-x64.msi      | MSI package for organizations |
| NEBULA-2.0.0.apk          | Android APK |

## Install on Windows

1. Run NEBULA-2.0.0-Setup.exe
2. Windows may warn -> "More info" -> "Run anyway"
3. Follow the installer wizard
4. Shortcut appears in Start menu

## Install on Android

1. Copy NEBULA-2.0.0.apk to your phone (USB / Telegram / Google Drive)
2. Open the file in a file manager
3. Android asks for permission -> "Allow"
4. Tap "Install"
5. Icon appears on home screen

## Requirements

- Windows 10 or 11 (WebView2 built-in)
- Android 7.0+
'@
$readme | Out-File -FilePath "$outDir\README.md" -Encoding utf8

# ===== 4. SUMMARY =====
$totalTime = [math]::Round(((Get-Date) - $startTime).TotalMinutes, 1)

Write-Host ""
Write-Host "===================================================" -ForegroundColor Green
Write-Host "  DONE! Total: $totalTime min." -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Folder: $outDir\" -ForegroundColor White
Write-Host ""

Get-ChildItem $outDir | ForEach-Object {
    if ($_.PSIsContainer) { return }
    $mb = [math]::Round($_.Length / 1MB, 2)
    Write-Host "  - $($_.Name)  --  $mb MB" -ForegroundColor White
}

Write-Host ""
Write-Host "Share: NEBULA-2.0.0-Setup.exe (PC) + NEBULA-2.0.0.apk (Android)" -ForegroundColor Cyan
Write-Host ""