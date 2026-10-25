# ============================================================
# PROJECT MAP GENERATOR
# Called from release.ps1 (during release) and context.ps1 (standalone)
# Returns path to generated file
# ============================================================

# Run git command with UTF-8 console output
function Invoke-GitUtf8 {
    param([string[]]$GitArgs)
    $prevEnc = [Console]::OutputEncoding
    $prevErr = $ErrorActionPreference
    try {
        [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
        $ErrorActionPreference = "Continue"
        # Native call operator passes each array element as-is.
        # No shell parsing: pipes and percents are safe.
        $out = & git @GitArgs 2>$null
    }
    finally {
        [Console]::OutputEncoding = $prevEnc
        $ErrorActionPreference = $prevErr
    }
    return $out
}

# ============================================================
# FILE TREE
# ============================================================

function Build-Tree {
    param(
        [string]$Path,
        [string]$Prefix = "",
        [int]$MaxDepth = 3,
        [int]$Depth = 0
    )
    if ($Depth -gt $MaxDepth) { return @() }

    $out = @()
    $children = @(Get-ChildItem -Path $Path -ErrorAction SilentlyContinue |
        Sort-Object @{E={!$_.PSIsContainer}}, Name)
    $total = $children.Count
    $i = 0

    foreach ($child in $children) {
        $i++
        $isLast = ($i -eq $total)
        $connector = "+-- "

        if ($child.PSIsContainer) {
            $out += "$Prefix$connector$($child.Name)/"
            $subPrefix = $Prefix + $(if ($isLast) { "    " } else { "|   " })
            $out += Build-Tree -Path $child.FullName -Prefix $subPrefix -MaxDepth $MaxDepth -Depth ($Depth + 1)
        }
        else {
            $loc = 0
            $ext = $child.Extension.ToLower()
            if ($ext -in @(".ts",".js",".css",".html",".ps1",".rs",".gradle",".json")) {
                try {
                    $loc = @(Get-Content $child.FullName -Encoding UTF8 -ErrorAction SilentlyContinue).Count
                }
                catch { $loc = 0 }
            }
            $locStr = "{0,5}" -f $loc
            $out += "$Prefix$connector$locStr $($child.Name)"
        }
    }
    return $out
}

# ============================================================
# EXPORTS EXTRACTION
# ============================================================

function Extract-Exports {
    param([string]$FilePath)
    $content = Get-Content $FilePath -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
    if (-not $content) { return @() }

    $exports = @()

    [regex]::Matches($content, '(?m)^export\s+(?:async\s+)?function\s+(\w+)') | ForEach-Object {
        $exports += "$($_.Groups[1].Value)()"
    }
    [regex]::Matches($content, '(?m)^export\s+const\s+(\w+)') | ForEach-Object {
        $exports += "$($_.Groups[1].Value) (const)"
    }
    [regex]::Matches($content, '(?m)^export\s+let\s+(\w+)') | ForEach-Object {
        $exports += "$($_.Groups[1].Value) (let)"
    }
    [regex]::Matches($content, '(?m)^export\s+interface\s+(\w+)') | ForEach-Object {
        $exports += "$($_.Groups[1].Value) (iface)"
    }
    [regex]::Matches($content, '(?m)^export\s+type\s+(\w+)') | ForEach-Object {
        $exports += "$($_.Groups[1].Value) (type)"
    }
    [regex]::Matches($content, '(?m)^export\s+class\s+(\w+)') | ForEach-Object {
        $exports += "$($_.Groups[1].Value) (class)"
    }

    return @($exports | Select-Object -Unique)
}

# ============================================================
# WINDOW EXPORTS BY MODULE (grouped)
# ============================================================

function Extract-WindowExportsByModule {
    param([string]$SrcDir)
    $result = @{}
    $files = @(Get-ChildItem -Path $SrcDir -Recurse -Filter "*.ts" -ErrorAction SilentlyContinue)

    foreach ($f in $files) {
        $content = Get-Content $f.FullName -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
        if (-not $content) { continue }

        $names = @()

        # Object.assign(window as any, { a, b, c })
        [regex]::Matches($content, 'Object\.assign\s*\(\s*window[^,]*,\s*\{([\s\S]*?)\}\s*\)') | ForEach-Object {
            $body = $_.Groups[1].Value
            $body -split ',' | ForEach-Object {
                $item = $_.Trim()
                $key = ($item -split ':')[0].Trim()
                if ($key -match '^[a-zA-Z_][a-zA-Z0-9_]*$') { $names += $key }
            }
        }

        # window.NAME = ... (single assignment)
        [regex]::Matches($content, '(?m)^window\.(\w+)\s*=') | ForEach-Object {
            $names += $_.Groups[1].Value
        }

        # (window as any).NAME = ...
        [regex]::Matches($content, '\(window\s+as\s+any\)\.(\w+)\s*=') | ForEach-Object {
            $names += $_.Groups[1].Value
        }

        $unique = @($names | Select-Object -Unique | Sort-Object)
        if ($unique.Count -gt 0) {
            $cwdPath = (Get-Location).Path
            $rel = $f.FullName
            if ($rel.StartsWith($cwdPath)) {
                $rel = $rel.Substring($cwdPath.Length).TrimStart('\', '/')
            }
            $rel = $rel -replace '\\', '/'
            $result[$rel] = $unique
        }
    }
    return $result
}

# ============================================================
# ENDPOINTS
# ============================================================

function Extract-Endpoints {
    param([string]$SrcDir)
    $endpoints = @{}
    $skipHosts = @("127.0.0.1", "localhost", "0.0.0.0")
    $files = @(Get-ChildItem -Path $SrcDir -Recurse -Filter "*.ts" -ErrorAction SilentlyContinue)

    foreach ($f in $files) {
        $content = Get-Content $f.FullName -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
        if (-not $content) { continue }

        [regex]::Matches($content, 'https?://([a-zA-Z0-9.\-]+)') | ForEach-Object {
            $h = $_.Groups[1].Value.TrimEnd('.')
            if ($skipHosts -contains $h) { return }
            if ($h -notmatch '\.[a-zA-Z]{2,}$') { return }
            if (-not $endpoints[$h]) { $endpoints[$h] = $f.Name }
        }
        [regex]::Matches($content, 'wss?://([a-zA-Z0-9\-]{4,}\.[a-zA-Z0-9.\-]+)') | ForEach-Object {
            $h = "WS " + $_.Groups[1].Value.TrimEnd('.')
            if (-not $endpoints[$h]) { $endpoints[$h] = $f.Name }
        }
    }
    return $endpoints
}

# ============================================================
# DOM IDs
# ============================================================

function Extract-DOMIds {
    param([string]$HtmlPath)
    if (-not (Test-Path $HtmlPath)) { return @() }
    $html = Get-Content $HtmlPath -Raw -Encoding UTF8
    $ids = @()
    [regex]::Matches($html, 'id="([^"]+)"') | ForEach-Object {
        $ids += $_.Groups[1].Value
    }
    return @($ids | Select-Object -Unique | Sort-Object)
}

# Critical DOM IDs that must exist or app breaks
function Get-CriticalDomIds {
    return @(
        "ticker", "chart-container", "chart-stats", "tf-bar",
        "verdict", "verdict-title", "verdict-text",
        "plan-card", "agent-card", "whale-card",
        "dash-section", "dash-network-content",
        "screen-home", "screen-pro", "screen-scanner",
        "sheet", "sheet-overlay", "sheet-title", "sheet-body",
        "toast-wrap", "app-lock-overlay",
        "al-input", "al-submit"
    )
}

# ============================================================
# STATE SHAPE
# ============================================================

function Extract-StateShape {
    param([string]$UtilsPath)
    if (-not (Test-Path $UtilsPath)) { return @() }
    $content = Get-Content $UtilsPath -Raw -Encoding UTF8
    if ($content -notmatch 'export\s+const\s+state\s*=\s*\{([\s\S]*?)\n\};') {
        return @()
    }
    $body = $Matches[1]
    $fields = @()
    $body -split "`n" | ForEach-Object {
        # Strip comments first, then trailing comma
        $line = $_.Trim()
        $line = $line -replace '\s*//.*$', ''
        $line = $line -replace '/\*.*?\*/', ''
        $line = $line.Trim()
        if ($line -match '^(\w+)\s*:\s*(.+?),?$') {
            $name = $Matches[1]
            $type = $Matches[2] -replace ',\s*$', '' -replace '\s+as\s+.*$', ''
            if ($type.Length -gt 70) { $type = $type.Substring(0, 67) + "..." }
            $fields += "$name`: $type"
        }
    }
    return @($fields)
}

# ============================================================
# DUPLICATE EXPORTS
# ============================================================

function Find-DuplicateExports {
    param([string]$SrcDir)
    $byName = @{}
    $files = @(Get-ChildItem -Path $SrcDir -Recurse -Filter "*.ts" -ErrorAction SilentlyContinue)
    $cwdPath = (Get-Location).Path

    foreach ($f in $files) {
        $rel = $f.FullName
        if ($rel.StartsWith($cwdPath)) { $rel = $rel.Substring($cwdPath.Length).TrimStart('\', '/') }
        $rel = $rel -replace '\\', '/'

        $content = Get-Content $f.FullName -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
        if (-not $content) { continue }

        # Only interfaces and types - duplicates there are real problems
        [regex]::Matches($content, '(?m)^export\s+(?:interface|type)\s+(\w+)') | ForEach-Object {
            $name = $_.Groups[1].Value
            if (-not $byName[$name]) { $byName[$name] = @() }
            $byName[$name] += $rel
        }
    }

    $dupes = @()
    foreach ($name in $byName.Keys) {
        $files = @($byName[$name] | Select-Object -Unique)
        if ($files.Count -gt 1) {
            $dupes += [PSCustomObject]@{ Name = $name; Files = $files }
        }
    }
    return @($dupes | Sort-Object Name)
}

# ============================================================
# TECH DEBT (TODO / FIXME / HACK / XXX)
# ============================================================

function Find-TechDebt {
    param([string]$SrcDir)
    $items = @()
    $files = @(Get-ChildItem -Path $SrcDir -Recurse -Filter "*.ts" -ErrorAction SilentlyContinue)
    $cwdPath = (Get-Location).Path

    foreach ($f in $files) {
        $rel = $f.FullName
        if ($rel.StartsWith($cwdPath)) { $rel = $rel.Substring($cwdPath.Length).TrimStart('\', '/') }
        $rel = $rel -replace '\\', '/'

        $lines = @(Get-Content $f.FullName -Encoding UTF8 -ErrorAction SilentlyContinue)
        for ($i = 0; $i -lt $lines.Count; $i++) {
            if ($lines[$i] -match '\b(TODO|FIXME|HACK|XXX)\b') {
                $text = $lines[$i].Trim()
                if ($text.Length -gt 100) { $text = $text.Substring(0, 97) + "..." }
                $items += [PSCustomObject]@{
                    File = $rel
                    Line = $i + 1
                    Text = $text
                }
            }
        }
    }
    return $items
}

# ============================================================
# DEPENDENCIES
# ============================================================

function Get-KeyDependencies {
    $path = "package.json"
    if (-not (Test-Path $path)) { return @() }
    $content = Get-Content $path -Raw -Encoding UTF8
    $deps = @()

    $keys = @("lightweight-charts", "@capacitor/core", "@capacitor/android",
              "@tauri-apps/api", "@tauri-apps/cli", "typescript", "vite")

    foreach ($k in $keys) {
        $esc = [regex]::Escape($k)
        if ($content -match "`"$esc`"\s*:\s*`"([^`"]+)`"") {
            $deps += "$k : $($Matches[1])"
        }
    }
    return $deps
}

# ============================================================
# BUNDLE SIZE
# ============================================================

function Get-BundleSize {
    $distDir = "dist"
    if (-not (Test-Path $distDir)) { return $null }

    $files = @(Get-ChildItem -Path $distDir -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object { $_.Extension -in @(".js", ".css", ".html") })
    $totalBytes = ($files | Measure-Object -Property Length -Sum).Sum
    if (-not $totalBytes) { $totalBytes = 0 }

    return [PSCustomObject]@{
        FileCount = $files.Count
        TotalKB = [math]::Round($totalBytes / 1KB, 1)
    }
}

# ============================================================
# GIT INFO
# ============================================================

function Get-GitInfo {
    $branch = "unknown"
    $commit = "unknown"
    $lastTag = ""
    try {
        $branch = (git rev-parse --abbrev-ref HEAD 2>$null).Trim()
        $commit = (git rev-parse --short HEAD 2>$null).Trim()
        $tagOut = git describe --tags --abbrev=0 2>$null
        if ($LASTEXITCODE -eq 0 -and $tagOut) {
            $lastTag = $tagOut.Trim()
        }
    }
    catch { }
    return [PSCustomObject]@{
        Branch = $branch
        Commit = $commit
        LastTag = $lastTag
    }
}

function Get-RecentChanges {
    param([int]$Count = 5)
    $raw = Invoke-GitUtf8 @(
        "log",
        "--pretty=format:COMMIT|||%h|||%ad|||%s",
        "--date=format:%Y-%m-%d",
        "--name-only",
        "-n", "$Count"
    )
    if (-not $raw) { return @() }

    $result = @()
    $current = $null
    foreach ($line in $raw) {
        $line = [string]$line
            if ($line.StartsWith("COMMIT|||")) {
            if ($current) { $result += $current }
            $parts = $line -split '\|\|\|', 4
            $current = [PSCustomObject]@{
                Hash = $parts[1]
                Date = $parts[2]
                Subject = $parts[3]
                Files = @()
            }
        }
        elseif ($current -and $line.Trim()) {
            $current.Files += $line.Trim()
        }
    }
    if ($current) { $result += $current }
    return $result
}

function Get-TagsHistory {
    param([int]$Count = 10)
    $tags = Invoke-GitUtf8 @("tag", "--sort=-version:refname")
    if (-not $tags) { return @() }
    return @($tags | Where-Object { $_.Trim() } | Select-Object -First $Count)
}

function Get-DiffSinceTag {
    param([string]$Tag)
    if (-not $Tag) { return @() }
    $files = Invoke-GitUtf8 @("diff", "--name-only", "$Tag..HEAD")
    if (-not $files) { return @() }
    return @($files | Where-Object { $_.Trim() })
}

function Get-ReleaseHistory {
    param([int]$Count = 15)
    $raw = Invoke-GitUtf8 @(
        "log",
        "--pretty=format:%h|||%ad|||%s",
        "--date=format:%Y-%m-%d",
        "-n", "$Count"
    )
    if (-not $raw) { return @() }
    return @($raw | ForEach-Object {
        $parts = $_ -split '\|\|\|', 3
        if ($parts.Count -eq 3) {
            "$($parts[0])  $($parts[1])  $($parts[2])"
        }
    })
}

# ============================================================
# GENERATOR
# ============================================================

function Generate-ProjectMap {
    param(
        [string]$Version,
        [string]$OutputPath = "PROJECT_MAP.md"
    )

    $now = Get-Date -Format "yyyy-MM-dd HH:mm"
    $git = Get-GitInfo
    $srcDir = Join-Path (Get-Location) "src"
    $srcFiles = @(Get-ChildItem -Path $srcDir -Recurse -Filter "*.ts" -ErrorAction SilentlyContinue)

    $totalLoc = 0
    foreach ($f in $srcFiles) {
        try {
            $totalLoc += @(Get-Content $f.FullName -Encoding UTF8 -ErrorAction SilentlyContinue).Count
        }
        catch { }
    }

    $lines = @()

    # -------- HEADER --------
    $lines += "# NEBULA Oracle Terminal - Project Map"
    $lines += ""
    $lines += "> **Auto-generated** by ``scripts/release.ps1`` / ``scripts/context.ps1``"
    $lines += "> Version: **$Version** | Branch: ``$($git.Branch)`` | Commit: ``$($git.Commit)``"
    $lines += "> Generated: $now"
    $lines += ""
    $lines += "---"
    $lines += ""

    # -------- TOC --------
    $lines += "## Contents"
    $lines += ""
    $lines += "1. [Overview](#overview)"
    $lines += "2. [Stats](#stats)"
    $lines += "3. [Consistency check](#consistency-check)"
    $lines += "4. [Recent changes](#recent-changes)"
    $lines += "5. [Last release diff](#last-release-diff)"
    $lines += "6. [Recent tags](#recent-tags)"
    $lines += "7. [File tree](#file-tree-src)"
    $lines += "8. [Critical files](#critical-files)"
    $lines += "9. [Exports by file](#exports-by-file)"
    $lines += "10. [Duplicate exports](#duplicate-exports)"
    $lines += "11. [Window exports by module](#window-exports-by-module)"
    $lines += "12. [Network endpoints](#network-endpoints)"
    $lines += "13. [State shape](#state-shape-srcutilsts)"
    $lines += "14. [DOM contract](#dom-contract-indexhtml)"
    $lines += "15. [Key dependencies](#key-dependencies)"
    $lines += "16. [Tech debt](#tech-debt)"
    $lines += "17. [Release history](#release-history-last-15-commits)"
    $lines += ""
    $lines += "---"
    $lines += ""

    # -------- OVERVIEW --------
    $lines += "## Overview"
    $lines += ""
    $lines += "Cryptocurrency analysis + trading terminal."
    $lines += "One codebase, three platforms: Web / Android (Capacitor) / Windows (Tauri)."
    $lines += ""
    $lines += "**Stack:** TypeScript, Vite 5, lightweight-charts 4.2, Capacitor 8, Tauri 2, Web Crypto, Groq AI."
    $lines += ""

    # -------- STATS --------
    $lines += "## Stats"
    $lines += ""
    $lines += "- TypeScript files in ``src/``: $($srcFiles.Count)"
    $lines += "- Total LOC in ``src/``: $totalLoc"
    $bundle = Get-BundleSize
    if ($bundle) {
        $lines += "- Bundle (``dist/``): $($bundle.FileCount) files, $($bundle.TotalKB) KB"
    }
    else {
        $lines += "- Bundle (``dist/``): not built"
    }
    $lines += ""

    # -------- CONSISTENCY CHECK --------
    $lines += "## Consistency check"
    $lines += ""
    $lines += "- ``package.json`` version: **$Version**"
    if ($git.LastTag) {
        $lines += "- Last git tag: ``$($git.LastTag)``"
        if ($git.LastTag -eq "v$Version") {
            $lines += "- Status: **OK** (versions match)"
        }
        else {
            $lines += "- Status: **DRIFT** (package.json != last tag)"
        }
    }
    else {
        $lines += "- Last git tag: (none)"
        $lines += "- Status: **no tags yet**"
    }
    $lines += ""

    # -------- RECENT CHANGES --------
    $lines += "## Recent changes"
    $lines += ""
    $recent = Get-RecentChanges -Count 5
    if ($recent.Count -gt 0) {
        foreach ($c in $recent) {
            $lines += "### ``$($c.Hash)`` - $($c.Date) - $($c.Subject)"
            $lines += ""
            if ($c.Files.Count -gt 0) {
                $lines += "Files:"
                $c.Files | ForEach-Object { $lines += "- ``$_``" }
            }
            else {
                $lines += "_(no file changes)_"
            }
            $lines += ""
        }
    }
    else {
        $lines += "(no commits)"
        $lines += ""
    }

    # -------- LAST RELEASE DIFF --------
    $lines += "## Last release diff"
    $lines += ""
    if ($git.LastTag) {
        $diff = Get-DiffSinceTag -Tag $git.LastTag
        if ($diff.Count -gt 0) {
            $lines += "Files changed since ``$($git.LastTag)``: $($diff.Count)"
            $lines += ""
            $diff | ForEach-Object { $lines += "- ``$_``" }
        }
        else {
            $lines += "No changes since ``$($git.LastTag)``"
        }
    }
    else {
        $lines += "(no tags yet)"
    }
    $lines += ""

    # -------- RECENT TAGS --------
    $lines += "## Recent tags"
    $lines += ""
    $tags = Get-TagsHistory -Count 10
    if ($tags.Count -gt 0) {
        $tags | ForEach-Object { $lines += "- ``$_``" }
    }
    else {
        $lines += "(none)"
    }
    $lines += ""

    # -------- FILE TREE --------
    $lines += "## File tree (src/)"
    $lines += ""
    $lines += '```'
    $lines += "src/"
    $lines += (Build-Tree -Path $srcDir)
    $lines += '```'
    $lines += ""

    # -------- CRITICAL FILES --------
    $lines += "## Critical files"
    $lines += ""
    $lines += "Files that handle secrets, money, or auth. **Do not modify without backup.**"
    $lines += ""
    $critical = @(
        @{ Path = "src/auth.ts";        Note = "app password, biometrics" },
        @{ Path = "src/crypto.ts";      Note = "AES-256-GCM, PBKDF2, API keys" },
        @{ Path = "src/trading.ts";     Note = "orders, TWAP, MEXC API" },
        @{ Path = "src/sources/mexc.ts";Note = "exchange API signing (HMAC)" },
        @{ Path = "src/ai.ts";          Note = "Groq API, user prompts" },
        @{ Path = "src/main.ts";        Note = "bootstrap, fetch patch, auth" }
    )
    foreach ($cf in $critical) {
        $exists = if (Test-Path $cf.Path) { "OK" } else { "MISSING" }
        $lines += "- ``$($cf.Path)`` ($exists) - $($cf.Note)"
    }
    $lines += ""

    # -------- EXPORTS BY FILE --------
    $lines += "## Exports by file"
    $lines += ""
    $cwdPath = (Get-Location).Path
    foreach ($f in ($srcFiles | Sort-Object FullName)) {
        $rel = $f.FullName
        if ($rel.StartsWith($cwdPath)) {
            $rel = $rel.Substring($cwdPath.Length).TrimStart('\', '/')
        }
        $exports = Extract-Exports -FilePath $f.FullName
        if ($exports.Count -gt 0) {
            $lines += "### ``$($rel -replace '\\', '/')``"
            $exports | ForEach-Object { $lines += "- $_" }
            $lines += ""
        }
    }

    # -------- DUPLICATE EXPORTS --------
    $lines += "## Duplicate exports"
    $lines += ""
    $lines += "Same interface/type declared in multiple files. Candidates for refactor into shared module."
    $lines += ""
    $dupes = Find-DuplicateExports -SrcDir $srcDir
    if ($dupes.Count -gt 0) {
        foreach ($d in $dupes) {
            $lines += "- **$($d.Name)** - " + ($d.Files -join ", ")
        }
    }
    else {
        $lines += "(no duplicate type/interface names)"
    }
    $lines += ""

    # -------- WINDOW EXPORTS BY MODULE --------
    $lines += "## Window exports by module"
    $lines += ""
    $lines += "Functions/objects assigned to ``window`` for inline HTML handlers."
    $lines += ""
    $winByMod = Extract-WindowExportsByModule -SrcDir $srcDir
    if ($winByMod.Count -gt 0) {
        foreach ($mod in ($winByMod.Keys | Sort-Object)) {
            $names = $winByMod[$mod]
            $lines += "### ``$mod`` ($($names.Count))"
            $lines += ""
            $lines += ($names -join ", ")
            $lines += ""
        }
    }
    else {
        $lines += "(none)"
        $lines += ""
    }

    # -------- NETWORK ENDPOINTS --------
    $lines += "## Network endpoints"
    $lines += ""
    $endpoints = Extract-Endpoints -SrcDir $srcDir
    if ($endpoints.Count -gt 0) {
        foreach ($k in ($endpoints.Keys | Sort-Object)) {
            $lines += "- ``$k`` (in ``$($endpoints[$k])``)"
        }
    }
    else {
        $lines += "(none)"
    }
    $lines += ""

    # -------- STATE SHAPE --------
    $lines += "## State shape (src/utils.ts)"
    $lines += ""
    $stateFields = Extract-StateShape -UtilsPath (Join-Path $srcDir "utils.ts")
    if ($stateFields.Count -gt 0) {
        $lines += '```'
        $stateFields | ForEach-Object { $lines += $_ }
        $lines += '```'
    }
    else {
        $lines += "(not parsed)"
    }
    $lines += ""

    # -------- DOM CONTRACT --------
    $lines += "## DOM contract (index.html)"
    $lines += ""
    $critical = Get-CriticalDomIds
    $allIds = Extract-DOMIds -HtmlPath (Join-Path (Get-Location) "index.html")

    $missing = @()
    foreach ($id in $critical) {
        if ($allIds -notcontains $id) { $missing += $id }
    }

    $lines += "**Critical IDs** (app breaks if missing): $($critical.Count)"
    if ($missing.Count -eq 0) {
        $lines += "- Status: **all present**"
    }
    else {
        $lines += "- Status: **MISSING: $($missing -join ', ')**"
    }
    $lines += ""
    $lines += "Critical list: " + ($critical -join ", ")
    $lines += ""
    $lines += "All IDs in index.html ($($allIds.Count) total):"
    $lines += ""
    $lines += ($allIds -join ", ")
    $lines += ""

    # -------- KEY DEPENDENCIES --------
    $lines += "## Key dependencies"
    $lines += ""
    $deps = Get-KeyDependencies
    if ($deps.Count -gt 0) {
        $deps | ForEach-Object { $lines += "- ``$_``" }
    }
    else {
        $lines += "(none parsed)"
    }
    $lines += ""

    # -------- TECH DEBT --------
    $lines += "## Tech debt"
    $lines += ""
    $debt = Find-TechDebt -SrcDir $srcDir
    if ($debt.Count -gt 0) {
        $lines += "$($debt.Count) markers found (TODO / FIXME / HACK / XXX):"
        $lines += ""
        foreach ($d in $debt) {
            $lines += "- ``$($d.File):$($d.Line)`` - $($d.Text)"
        }
    }
    else {
        $lines += "(no TODO/FIXME/HACK markers)"
    }
    $lines += ""

    # -------- RELEASE HISTORY --------
    $lines += "## Release history (last 15 commits)"
    $lines += ""
    $history = Get-ReleaseHistory -Count 15
    if ($history.Count -gt 0) {
        $history | ForEach-Object { $lines += "- $_" }
    }
    else {
        $lines += "(no commits)"
    }
    $lines += ""
    $lines += "---"
    $lines += ""
    $lines += "> Regenerate: ``npm run context`` or ``.\scripts\context.ps1``"

    $text = ($lines -join "`n") + "`n"
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    $fullPath = Join-Path (Get-Location) $OutputPath
    [System.IO.File]::WriteAllText($fullPath, $text, $utf8NoBom)

    return $fullPath
}