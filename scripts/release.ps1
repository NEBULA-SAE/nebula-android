<#
.SYNOPSIS
  NEBULA - smart release: check + bump version + build + commit + push

.EXAMPLE
  .\scripts\release.ps1 -DryRun
  .\scripts\release.ps1
  .\scripts\release.ps1 -Minor -Yes
  .\scripts\release.ps1 -SkipBuild

.NOTES
  Requires: node, npm, git, JDK 21, Rust (for Windows build).
#>

param(
    [ValidateSet("patch","minor","major")] [string]$Bump = "patch",
    [string]$Version = "",
    [switch]$SkipBuild,
    [switch]$SkipPush,
    [switch]$SkipTests,
    [switch]$DryRun,
    [switch]$Yes
)

$ErrorActionPreference = "Stop"

# ============================================================
# FILE I/O HELPERS - always UTF-8, never BOM
# ============================================================

function Read-FileUtf8 {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return $null }
    return [System.IO.File]::ReadAllText((Join-Path (Get-Location) $Path), [System.Text.Encoding]::UTF8)
}

function Write-FileUtf8 {
    param([string]$Path, [string]$Content)
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    $full = Join-Path (Get-Location) $Path
    [System.IO.File]::WriteAllText($full, $Content, $utf8NoBom)
}

# ============================================================
# GIT HELPER - suppress stderr warnings, keep exit code
# ============================================================

function Invoke-GitSafe {
    param([Parameter(ValueFromRemainingArguments=$true)][string[]]$GitArgs)
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $out = & git @GitArgs 2>$null
        return $out
    }
    finally {
        $ErrorActionPreference = $prevEAP
    }
}

# ============================================================
# IMPORT PROJECT_MAP GENERATOR
# ============================================================

$mapScript = Join-Path $PSScriptRoot "project-map.ps1"
if (Test-Path $mapScript) {
    . $mapScript
}
else {
    Write-Host "  [WARN] project-map.ps1 not found - PROJECT_MAP.md will be skipped" -ForegroundColor Yellow
}

# ============================================================
# VERSION FILE CONFIG
# ============================================================

$VERSION_FILES = @(
    @{
        Path = "package.json"; Required = $true; Label = "package.json"
        Pattern = '"version":\s*"(\d+\.\d+\.\d+)"'
        Replace = '"version": "{V}"'
        Count = 1
    },
    @{
        Path = "package-lock.json"; Required = $true; Label = "package-lock.json (2x)"
        Pattern = '"version":\s*"(\d+\.\d+\.\d+)"'
        Replace = '"version": "{V}"'
        Count = 2
    },
    @{
        Path = "src-tauri/tauri.conf.json"; Required = $true; Label = "tauri.conf.json"
        Pattern = '"version":\s*"(\d+\.\d+\.\d+)"'
        Replace = '"version": "{V}"'
        Count = 1
    },
    @{
        Path = "src-tauri/Cargo.toml"; Required = $true; Label = "Cargo.toml"
        Pattern = '(?m)^version\s*=\s*"(\d+\.\d+\.\d+)"'
        Replace = 'version = "{V}"'
        Count = 1
    },
    @{
        Path = "android/app/build.gradle"; Required = $true; Label = "build.gradle (versionName)"
        Pattern = 'versionName\s+"(\d+\.\d+\.\d+)"'
        Replace = 'versionName "{V}"'
        Count = 1
    },
    @{
        Path = "index.html"; Required = $true; Label = "index.html (hero)"
        Pattern = '([\u00B7]\s+v)(\d+\.\d+\.\d+)'
        Replace = '${1}{V}'
        Count = 1
    },
    @{
        Path = "index.html"; Required = $true; Label = "index.html (about)"
        Pattern = '(>v)(\d+\.\d+\.\d+)'
        Replace = '${1}{V}'
        Count = 1
    },
    @{
        Path = "README.md"; Required = $false; Label = "README.md"
        Pattern = '([\u00B7]\s+v)(\d+\.\d+\.\d+)'
        Replace = '${1}{V}'
        Count = 1
    }
)

$GRADLE_PATH = "android/app/build.gradle"

# ============================================================
# OUTPUT HELPERS
# ============================================================

function Write-Banner {
    param([string]$Text)
    Write-Host ""
    Write-Host "+-----------------------------------------------------------+" -ForegroundColor DarkCyan
    Write-Host ("|  " + $Text.PadRight(57) + "|") -ForegroundColor Cyan
    Write-Host "+-----------------------------------------------------------+" -ForegroundColor DarkCyan
}
function Write-Step {
    param([string]$T)
    Write-Host ""
    Write-Host "> $T" -ForegroundColor Cyan
}
function Write-Ok {
    param([string]$T)
    Write-Host "  [OK]   $T" -ForegroundColor Green
}
function Write-Warn {
    param([string]$T)
    Write-Host "  [WARN] $T" -ForegroundColor Yellow
}
function Write-Err {
    param([string]$T)
    Write-Host "  [ERR]  $T" -ForegroundColor Red
}
function Write-Info {
    param([string]$T)
    Write-Host "         $T" -ForegroundColor DarkGray
}
function Write-Detail {
    param([string]$T)
    Write-Host "         $T" -ForegroundColor Gray
}
function Fail {
    param([string]$T)
    Write-Err $T
    Write-Host ""
    Write-Host "Release aborted." -ForegroundColor Red
    exit 1
}

function Confirm-Step {
    param([string]$Q, [switch]$DefaultYes)
    if ($Yes) { return $true }
    $suffix = if ($DefaultYes) { "[Y/n]" } else { "[y/N]" }
    $a = Read-Host "$Q $suffix"
    if ([string]::IsNullOrWhiteSpace($a)) { return [bool]$DefaultYes }
    return $a -match "^[yY]"
}

# ============================================================
# SEMVER
# ============================================================

function Get-NextVersion {
    param([string]$Current, [string]$Kind, [string]$Explicit)
    if ($Explicit) {
        if ($Explicit -notmatch '^\d+\.\d+\.\d+$') {
            throw "Bad version: $Explicit (expect X.Y.Z)"
        }
        return $Explicit
    }
    if ($Current -notmatch '^\d+\.\d+\.\d+$') {
        throw "Current version not semver: '$Current' (expect X.Y.Z)"
    }
    $p = $Current -split '\.'
    if ($p.Count -ne 3) { throw "Current version not semver: $Current" }
    $maj = [int]$p[0]; $min = [int]$p[1]; $pat = [int]$p[2]
    switch ($Kind) {
        "major" { $maj++; $min = 0; $pat = 0 }
        "minor" { $min++; $pat = 0 }
        "patch" { $pat++ }
    }
    return "$maj.$min.$pat"
}

# ============================================================
# VERSIONS - read / update / check
# ============================================================

function Get-AllVersions {
    $result = @()
    foreach ($cfg in $VERSION_FILES) {
        $row = [PSCustomObject]@{
            Path = $cfg.Path
            Label = $cfg.Label
            Required = $cfg.Required
            Version = $null
            Exists = (Test-Path $cfg.Path)
        }
        if ($row.Exists) {
            $content = Read-FileUtf8 -Path $cfg.Path
            if ($content -and $content -match $cfg.Pattern) {
                # 2-group patterns: version is in group 2 (group 1 = prefix like ">v" or "* v")
                if ($Matches.Count -gt 2 -and $Matches[2]) {
                    $row.Version = [string]$Matches[2]
                }
                else {
                    $row.Version = [string]$Matches[1]
                }
            }
        }
        $result += $row
    }
    return $result
}

function Show-VersionTable {
    param([array]$Versions, [string]$Expected = $null, [string]$Title = "Current versions")
    Write-Host ""
    Write-Host "  ${Title}:" -ForegroundColor White
    Write-Host "  +-------------------------------------+----------+--------+" -ForegroundColor DarkGray
    Write-Host "  | File                                | Version  | Status |" -ForegroundColor DarkGray
    Write-Host "  +-------------------------------------+----------+--------+" -ForegroundColor DarkGray

    foreach ($v in $Versions) {
        $name = $v.Label
        if ($name.Length -gt 35) { $name = $name.Substring(0, 32) + "..." }
        $ver = if ($v.Version) { $v.Version } else { "-" }

        $status = ""
        $color = "Gray"
        if (-not $v.Exists) {
            $status = if ($v.Required) { "MISS" } else { "opt" }
            $color = if ($v.Required) { "Red" } else { "DarkGray" }
        }
        elseif (-not $v.Version) {
            $status = "none"
            $color = if ($v.Required) { "Yellow" } else { "DarkGray" }
        }
        elseif ($Expected -and $v.Version -ne $Expected) {
            $status = "DRIFT"
            $color = "Yellow"
        }
        else {
            $status = "OK"
            $color = "Green"
        }

        $line = "  | {0,-35} | {1,-8} | {2,-6} |" -f $name, $ver, $status
        Write-Host $line -ForegroundColor $color
    }
    Write-Host "  +-------------------------------------+----------+--------+" -ForegroundColor DarkGray
}

function Test-Consistency {
    param([array]$Versions)
    # Force array - otherwise single element becomes string,
    # and $unique[0] returns first CHARACTER instead of whole version.
    $withVersion = @($Versions | Where-Object { $_.Version })
    if ($withVersion.Count -eq 0) { return $null }

    $unique = @($withVersion | ForEach-Object { [string]$_.Version } | Select-Object -Unique)

    if ($unique.Count -gt 1) {
        return [PSCustomObject]@{
            Consistent = $false
            Versions = $unique
            Reference = [string]$unique[0]
        }
    }
    return [PSCustomObject]@{
        Consistent = $true
        Versions = $unique
        Reference = [string]$unique[0]
    }
}

function Update-AllVersions {
    param([string]$NewVersion)
    $report = @()
    foreach ($cfg in $VERSION_FILES) {
        $row = [PSCustomObject]@{
            Path = $cfg.Path
            Label = $cfg.Label
            Updated = $false
            Old = $null
            New = $null
            Error = $null
        }
        if (-not (Test-Path $cfg.Path)) {
            $row.Error = "file missing"
            $report += $row
            continue
        }
        try {
            $content = Read-FileUtf8 -Path $cfg.Path
            if ($content -and $content -match $cfg.Pattern) {
                # Same rule as Get-AllVersions: version in group 2 when prefix present
                if ($Matches.Count -gt 2 -and $Matches[2]) {
                    $row.Old = [string]$Matches[2]
                }
                else {
                    $row.Old = [string]$Matches[1]
                }
            }
            $replacement = $cfg.Replace -replace '\{V\}', $NewVersion
            $newContent = [regex]::Replace($content, $cfg.Pattern, $replacement, $cfg.Count)

            if ($newContent -ne $content) {
                Write-FileUtf8 -Path $cfg.Path -Content $newContent
                $row.Updated = $true
                $row.New = $NewVersion
            }
            else {
                $row.New = $row.Old
            }
        }
        catch {
            $row.Error = $_.ToString()
        }
        $report += $row
    }
    return $report
}

function Get-VersionCode {
    param([string]$Path)
    $c = Read-FileUtf8 -Path $Path
    if (-not $c) { return $null }
    if ($c -match 'versionCode\s+(\d+)') { return [int]$Matches[1] }
    return $null
}

function Update-VersionCode {
    param([string]$Path, [int]$NewCode)
    $c = Read-FileUtf8 -Path $Path
    if (-not $c) { return $null }
    if ($c -match 'versionCode\s+(\d+)') {
        $old = [int]$Matches[1]
        $c = [regex]::Replace($c, 'versionCode\s+\d+', "versionCode $NewCode", 1)
        Write-FileUtf8 -Path $Path -Content $c
        return @{ Old = $old; New = $NewCode }
    }
    return $null
}

# ============================================================
# START
# ============================================================

Clear-Host
Write-Banner "NEBULA - SMART RELEASE v2"

# ---- 1/9 ENVIRONMENT ----
Write-Step "1/9 - Environment"

if (-not (Test-Path "package.json") -or -not (Test-Path "src")) {
    Fail "Run from project root (C:\Users\Semen\nebula-v2)"
}
Write-Ok "Project root: $(Get-Location)"

foreach ($cmd in @("node","npm","git")) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { Fail "$cmd not in PATH" }
}
Write-Ok "node $(node --version), npm $(npm --version), git OK"

if (-not (Test-Path ".git")) { Fail "Not a git repository" }
if (-not (Test-Path "node_modules")) {
    Write-Warn "node_modules missing"
    if (-not (Confirm-Step "npm install now?")) { Fail "Cancelled" }
    npm install
}

if (Test-Path "android/app/nebula-release.keystore") {
    $ig = Invoke-GitSafe check-ignore "android/app/nebula-release.keystore"
    if (-not $ig) { Fail "Keystore NOT in .gitignore - critical!" }
    Write-Ok "Keystore protected by .gitignore"
}

# ---- 2/9 GIT STATUS ----
Write-Step "2/9 - Git changes"

$branch = (Invoke-GitSafe rev-parse --abbrev-ref HEAD).Trim()
if (-not $branch) { $branch = "unknown" }
Write-Ok "Branch: $branch"

$staged = @(Invoke-GitSafe diff --cached --name-only)
$unstaged = @(Invoke-GitSafe diff --name-only)
$untracked = @(Invoke-GitSafe ls-files --others --exclude-standard)
$staged = @($staged | Where-Object { $_ })
$unstaged = @($unstaged | Where-Object { $_ })
$untracked = @($untracked | Where-Object { $_ })
$total = $staged.Count + $unstaged.Count + $untracked.Count

Write-Info "staged=$($staged.Count), unstaged=$($unstaged.Count), untracked=$($untracked.Count)"

if ($total -gt 0) {
    Write-Detail "Files (first 10):"
    @($staged + $unstaged + $untracked) | Select-Object -First 10 | ForEach-Object { Write-Detail "  * $_" }
    if ($total -gt 10) { Write-Detail "  ... and $($total - 10) more" }
}

# ---- 3/9 SECRETS SCAN ----
Write-Step "3/9 - Secrets scanner"

$prevEAP = $ErrorActionPreference
$ErrorActionPreference = "Continue"
try {
    git add -A 2>&1 | Out-Null
}
finally {
    $ErrorActionPreference = $prevEAP
}

$stagedFiles = @(Invoke-GitSafe diff --cached --name-only)
$bad = @($stagedFiles | Where-Object {
    $_ -and (
        $_ -match '\.(keystore|jks|p12|pfx|pem|key)$' -or
        $_ -match '^\.env' -or
        $_ -match 'dump\.txt$' -or
        $_ -match '\.backup$'
    )
})
if ($bad.Count -gt 0) {
    Write-Err "Forbidden files staged:"
    $bad | ForEach-Object { Write-Detail "  * $_" }
    Fail "Remove them from staged"
}
Write-Ok "No forbidden files"

$secretPatterns = @(
    @{ N = "Groq API";    R = 'gsk_[A-Za-z0-9]{40,}' },
    @{ N = "GitHub PAT";  R = 'ghp_[A-Za-z0-9]{30,}' },
    @{ N = "OpenAI";      R = 'sk-[A-Za-z0-9]{40,}' },
    @{ N = "Private key"; R = '-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----' },
    @{ N = "JWT Bearer";  R = 'Bearer\s+eyJ[A-Za-z0-9_-]{30,}' },
    @{ N = "Password";    R = '(?i)(password|passwd|pwd)\s*[:=]\s*["''][^"'']{8,}["'']' }
)

$added = @(Invoke-GitSafe diff --cached --unified=0 --no-color |
    Where-Object { $_ -match '^\+' -and $_ -notmatch '^\+\+\+' })
$found = @()
foreach ($p in $secretPatterns) {
    foreach ($line in $added) {
        if ($line -match '(?i)(example|placeholder|test|mock|fake|dummy|xxx)') { continue }
        if ($line -match '^\+\s*(//|\*)') { continue }
        if ($line -match $p.R) {
            $t = $line.Trim()
            if ($t.Length -gt 90) { $t = $t.Substring(0, 90) + "..." }
            $found += "$($p.N): $t"
        }
    }
}
if ($found.Count -gt 0) {
    Write-Err "Secrets detected:"
    $found | Select-Object -First 5 | ForEach-Object { Write-Detail "  * $_" }
    Fail "Remove or use -SkipTests"
}
Write-Ok "No secrets in diff"

# ---- 4/9 TYPESCRIPT ----
if (-not $SkipTests) {
    Write-Step "4/9 - TypeScript"
    $out = npm run check 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Err "TypeScript errors:"
        $out | Select-Object -Last 20 | ForEach-Object { Write-Detail $_ }
        Fail "Fix types first"
    }
    Write-Ok "0 errors"
}
else {
    Write-Step "4/9 - TypeScript (skipped)"
}

# ---- 5/9 VERSIONS ----
Write-Step "5/9 - Versions"

$currentVersions = Get-AllVersions
Show-VersionTable -Versions $currentVersions -Title "BEFORE release"

# package.json is source of truth. Read directly.
$current = $null
$pkgRaw = Read-FileUtf8 -Path "package.json"
if ($pkgRaw -and $pkgRaw -match '"version"\s*:\s*"(\d+\.\d+\.\d+)"') {
    $current = [string]$Matches[1]
}
if (-not $current) {
    Fail "Cannot read version from package.json (expected X.Y.Z)"
}

# Show drift as warning - does not block.
$consistency = Test-Consistency -Versions $currentVersions
if ($consistency -and -not $consistency.Consistent) {
    Write-Warn "DRIFT: files have different versions: $($consistency.Versions -join ', ')"
    Write-Info "package.json is source of truth: $current"
    Write-Info "All files will be set to next version of $current"
    if (-not (Confirm-Step "Continue?" -DefaultYes)) { Fail "Cancelled" }
}

$newVersion = Get-NextVersion -Current $current -Kind $Bump -Explicit $Version
Write-Ok "Version: $current -> $newVersion"

$currentCode = Get-VersionCode -Path $GRADLE_PATH
$newCode = if ($null -ne $currentCode) { $currentCode + 1 } else { 1 }
$codeLabel = if ($null -ne $currentCode) { $currentCode } else { "-" }
Write-Ok "versionCode: $codeLabel -> $newCode"

if ($DryRun) {
    Write-Host ""
    Write-Host "  [DRY RUN] No files changed." -ForegroundColor Yellow
    Write-Info "Would update:"
    Write-Detail "  * Version $current -> $newVersion in all files above"
    Write-Detail "  * versionCode $codeLabel -> $newCode"
    Write-Host ""
    Write-Host "  [DRY RUN] Build and git skipped." -ForegroundColor Yellow
    exit 0
}

if (-not (Confirm-Step "Apply bump $current -> ${newVersion}?" -DefaultYes)) { Fail "Cancelled" }

# ---- Backup for rollback ----
$backup = @{}
foreach ($cfg in $VERSION_FILES) {
    if (Test-Path $cfg.Path) {
        $backup[$cfg.Path] = Read-FileUtf8 -Path $cfg.Path
    }
}
if (Test-Path $GRADLE_PATH) {
    $backup["__code__"] = Read-FileUtf8 -Path $GRADLE_PATH
}

function Restore-Backup {
    if ($backup.Count -eq 0) {
        Write-Warn "No backup to restore (empty backup map)"
        return
    }
    $restored = 0
    foreach ($k in $backup.Keys) {
        if ($k -eq "__code__") { continue }
        if ($null -eq $backup[$k]) { continue }
        try {
            Write-FileUtf8 -Path $k -Content $backup[$k]
            $restored++
        }
        catch { }
    }
    if ($backup.ContainsKey("__code__") -and $null -ne $backup["__code__"]) {
        try {
            Write-FileUtf8 -Path $GRADLE_PATH -Content $backup["__code__"]
        }
        catch { }
    }
    Write-Warn "Version files restored ($restored files)"
}

try {
    $updateReport = Update-AllVersions -NewVersion $newVersion
    $updatedCount = ($updateReport | Where-Object { $_.Updated }).Count
    Write-Ok "Files updated: $updatedCount / $($VERSION_FILES.Count)"

    foreach ($r in $updateReport) {
        if ($r.Error) { Write-Warn "$($r.Label): $($r.Error)" }
        elseif ($r.Updated) { Write-Detail "  $($r.Label): $($r.Old) -> $($r.New)" }
        elseif ($r.Old) { Write-Info "  $($r.Label): already $($r.Old)" }
    }

    if ($null -ne $currentCode) {
        $codeResult = Update-VersionCode -Path $GRADLE_PATH -NewCode $newCode
        if ($codeResult) {
            Write-Detail "  build.gradle (versionCode): $($codeResult.Old) -> $($codeResult.New)"
        }
    }
}
catch {
    Restore-Backup
    Fail "Error updating versions: $_"
}

# ---- Verify AFTER bump ----
Write-Host ""
Write-Host "  Post-bump check:" -ForegroundColor White
$afterVersions = Get-AllVersions
Show-VersionTable -Versions $afterVersions -Expected $newVersion -Title "AFTER bump"

$drift = @($afterVersions | Where-Object {
    $_.Required -and $_.Exists -and $_.Version -and $_.Version -ne $newVersion
})

if ($drift.Count -gt 0) {
    Write-Warn "These required files did NOT update:"
    $drift | ForEach-Object { Write-Detail "  * $($_.Label): $($_.Version) (expected $newVersion)" }
    if (-not (Confirm-Step "Continue despite drift?")) {
        Restore-Backup
        Fail "Cancelled"
    }
}
else {
    Write-Ok "All required files have $newVersion"
}

$finalCode = Get-VersionCode -Path $GRADLE_PATH
if ($finalCode -eq $newCode) {
    Write-Ok "versionCode = $newCode"
}
else {
    Write-Warn "versionCode = $finalCode (expected $newCode)"
}

# ---- 6/9 BUILD ----
if ($SkipBuild) {
    Write-Step "6/9 - Build (skipped)"
}
else {
    Write-Step "6/9 - Build Windows + Android"
    Write-Info "10-20 minutes. Do not close window."
    $scriptPath = ".\scripts\build-all.ps1"
    if (-not (Test-Path $scriptPath)) { Restore-Backup; Fail "$scriptPath not found" }
    try {
        & $scriptPath
        if ($LASTEXITCODE -ne 0) { throw "exit code $LASTEXITCODE" }
        Write-Ok "Build complete"
    }
    catch {
        Restore-Backup
        Fail "Build failed: $_"
    }
}

# ---- 7/9 ARTIFACTS ----
if (-not $SkipBuild) {
    Write-Step "7/9 - Artifacts"
    if (-not (Test-Path "dist_release")) { Restore-Backup; Fail "dist_release/ missing" }

    $expected = @(
        "NEBULA-$newVersion-Setup.exe",
        "NEBULA-$newVersion-Portable.exe",
        "NEBULA-$newVersion-x64.msi",
        "NEBULA-$newVersion.apk"
    )
    $missing = @()
    foreach ($f in $expected) {
        $p = Join-Path "dist_release" $f
        if (Test-Path $p) {
            $mb = [math]::Round((Get-Item $p).Length / 1MB, 2)
            Write-Ok "$f - $mb MB"
        }
        else { $missing += $f }
    }
    if ($missing.Count -gt 0) {
        Write-Warn "Missing: $($missing -join ', ')"
        Write-Info "Note: build-all.ps1 may use different filenames. Check dist_release/ manually."
        if (-not (Confirm-Step "Continue?")) { Restore-Backup; Fail "Cancelled" }
    }
}
else {
    Write-Step "7/9 - Artifacts (skipped)"
}

# ---- 7.5/9 PROJECT MAP ----
Write-Step "7.5/9 - PROJECT_MAP.md"
if (Get-Command Generate-ProjectMap -ErrorAction SilentlyContinue) {
    try {
        $mapPath = Generate-ProjectMap -Version $newVersion
        $mapKB = [math]::Round((Get-Item $mapPath).Length / 1KB, 1)
        Write-Ok "PROJECT_MAP.md - $mapKB KB"
    }
    catch {
        Write-Warn "Failed to generate PROJECT_MAP.md: $_"
    }
}
else {
    Write-Warn "Generate-ProjectMap not available (project-map.ps1 not imported)"
}

# ---- 8/9 COMMIT + TAG ----
Write-Step "8/9 - Git commit + tag"

$msg = @"
chore(release): v$newVersion

- Version: $current -> $newVersion
- versionCode: $codeLabel -> $newCode
- PROJECT_MAP.md: regenerated

Auto release via scripts/release.ps1
"@

Invoke-GitSafe add -A | Out-Null
if ($LASTEXITCODE -ne 0) { Restore-Backup; Fail "git add failed" }

Invoke-GitSafe commit -m $msg | Out-Null
if ($LASTEXITCODE -ne 0) { Restore-Backup; Fail "git commit failed (nothing to commit?)" }

$hash = (Invoke-GitSafe rev-parse --short HEAD).Trim()
Write-Ok "Commit: $hash"

$tag = "v$newVersion"
$existing = Invoke-GitSafe tag -l $tag
if ($existing) {
    Write-Warn "Tag $tag already exists, skipping"
}
else {
    Invoke-GitSafe tag -a $tag -m "Release $newVersion" | Out-Null
    if ($LASTEXITCODE -eq 0) { Write-Ok "Tag: $tag" }
    else { Write-Warn "Tag not created" }
}

# ---- 9/9 PUSH ----
if ($SkipPush) {
    Write-Step "9/9 - Push (skipped)"
}
else {
    Write-Step "9/9 - Push"

    Invoke-GitSafe push | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Err "git push failed. Commit $hash is local only."
        Write-Info "Check: git remote -v"
        Write-Info "Then: git push && git push --tags"
        exit 1
    }
    Write-Ok "Branch pushed"

    Invoke-GitSafe push --tags | Out-Null
    if ($LASTEXITCODE -eq 0) { Write-Ok "Tags pushed" }
    else { Write-Warn "Tags not pushed (commits pushed)" }
}

# ============================================================
# RESULT
# ============================================================

Write-Host ""
Write-Host "+-----------------------------------------------------------+" -ForegroundColor Green
Write-Host "|                                                           |" -ForegroundColor Green
Write-Host "|             RELEASE COMPLETED SUCCESSFULLY                |" -ForegroundColor Green
Write-Host "|                                                           |" -ForegroundColor Green
Write-Host "+-----------------------------------------------------------+" -ForegroundColor Green
Write-Host ""
Write-Host "  Version:      $newVersion" -ForegroundColor White
Write-Host "  versionCode:  $newCode" -ForegroundColor White
Write-Host "  Commit:       $hash" -ForegroundColor White
Write-Host "  Tag:          $tag" -ForegroundColor White
Write-Host "  Branch:       $branch" -ForegroundColor White
Write-Host ""

Write-Host "  Final consistency check:" -ForegroundColor White
$finals = Get-AllVersions
$allOk = $true
foreach ($v in $finals) {
    if (-not $v.Version) { continue }
    if ($v.Version -eq $newVersion) {
        Write-Host "    [OK]   $($v.Label): $($v.Version)" -ForegroundColor Green
    }
    else {
        Write-Host "    [WARN] $($v.Label): $($v.Version) (expected $newVersion)" -ForegroundColor Yellow
        if ($v.Required) { $allOk = $false }
    }
}
$finalCodeCheck = Get-VersionCode -Path $GRADLE_PATH
if ($finalCodeCheck -eq $newCode) {
    Write-Host "    [OK]   build.gradle (versionCode): $finalCodeCheck" -ForegroundColor Green
}
else {
    Write-Host "    [WARN] build.gradle (versionCode): $finalCodeCheck (expected $newCode)" -ForegroundColor Yellow
}

if ($allOk) {
    Write-Host ""
    Write-Host "  All required versions = $newVersion" -ForegroundColor Green
}

if (-not $SkipBuild -and (Test-Path "dist_release")) {
    Write-Host ""
    Write-Host "  Artifacts:" -ForegroundColor White
    Get-ChildItem "dist_release" -File |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 6 |
        ForEach-Object {
            $mb = [math]::Round($_.Length / 1MB, 2)
            Write-Host "    * $($_.Name) - $mb MB" -ForegroundColor Gray
        }
}

Write-Host ""
$url = (Invoke-GitSafe config --get remote.origin.url) -replace '\.git$', ''
Write-Host "  GitHub: $url" -ForegroundColor Cyan
Write-Host "  Tag:    $url/releases/tag/$tag" -ForegroundColor Cyan
Write-Host ""