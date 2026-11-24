<#
.SYNOPSIS
    Download and install Trajectory on Windows from native PowerShell.

.DESCRIPTION
    The PowerShell counterpart of install.sh. It downloads the latest release
    binary, checks it against checksums.sha256, installs it at
    %USERPROFILE%\.trajectory\bin\trajectory.exe, puts that folder on your user
    PATH, and runs `trajectory setup`.

    Works in Windows PowerShell 5.1 (ships with Windows) and PowerShell 7+.

.EXAMPLE
    # One line, no flags:
    irm https://raw.githubusercontent.com/datadog-labs/trajectory/main/install.ps1 | iex

.EXAMPLE
    # One line, with flags (irm | iex cannot pass parameters):
    & ([scriptblock]::Create((irm https://raw.githubusercontent.com/datadog-labs/trajectory/main/install.ps1))) -LocalOnly

.EXAMPLE
    # From a clone:
    powershell -ExecutionPolicy Bypass -File .\install.ps1 -LocalOnly -NonInteractive -Clients cc
#>

# Maintainer notes
# - Keep this installer slim: download, verify and place the binary, then hand
#   off to `trajectory setup`. Client discovery, client files and repairs
#   belong in the binary, where setup, doctor and updates reuse them.
#   CI fails a change that adds code lines to this file.
# - Keep this file pure ASCII. Windows PowerShell 5.1 reads a file without a
#   BOM as the system ANSI code page, so a stray em dash or check mark turns
#   into mojibake or a parse error.
# - Never `exit`: under `irm | iex` it closes the user's terminal. Use `throw`.
# - `irm | iex` cannot pass parameters, so each switch that a pasted install
#   may need also reads an environment variable.

# Everything, the parameters included, runs inside `& { ... } @args`, a child
# scope that is thrown away when it ends. Under `irm | iex` the script text
# runs in the caller's own session, so a top-level param() block would
# overwrite the caller's $Site, $Clients and the rest, and
# $ErrorActionPreference, StrictMode and every helper function would stay set
# in their terminal. @args forwards the arguments of `-File install.ps1 ...`
# and of the scriptblock form to the param() block below.
& {
[CmdletBinding()]
param(
    [switch] $LocalOnly,
    [switch] $NonInteractive,
    [string] $Site,
    [string] $MlApp,
    [string] $Clients,
    # Deliberately no -ApiKey: a key in arguments ends up in shell history and
    # process listings. Setup reads DD_API_KEY from the environment, which the
    # child process inherits, or prompts with hidden input.
    # Leave the user PATH unchanged. Also TRAJECTORY_INSTALL_SKIP_PATH=1.
    [switch] $SkipPath
)

# Stop on any cmdlet error instead of printing it and carrying on.
# Caveat: this does NOT cover native .exe failures in 5.1. Those only set
# $LASTEXITCODE, so every native call below checks it by hand.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 3.0

# 5.1 draws a progress bar for every downloaded chunk, which makes a 40 MB
# download take minutes. Turning it off makes Invoke-WebRequest fast.
$ProgressPreference = 'SilentlyContinue'

# 5.1 on older Windows builds may still default to TLS 1.0/1.1, which GitHub
# refuses. Add TLS 1.2 without removing what is already enabled.
[Net.ServicePointManager]::SecurityProtocol =
    [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

$Repo       = 'datadog-labs/trajectory'
$ReleaseUrl = "https://github.com/$Repo/releases/latest/download"
$InstallDir = Join-Path $env:USERPROFILE '.trajectory'
$BinDir     = Join-Path $InstallDir 'bin'
$Binary     = Join-Path $BinDir 'trajectory.exe'

function Write-Info([string] $Message) { Write-Host "[trajectory]  $Message" }

function Get-Platform {
    # A 32-bit PowerShell on 64-bit Windows reports x86 here and keeps the real
    # value in PROCESSOR_ARCHITEW6432.
    $arch = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
    switch ($arch) {
        'AMD64' { return 'windows-amd64' }
        # No arm64 Windows build is published. Windows 11 on ARM runs amd64
        # binaries under emulation, so fall back to that.
        'ARM64' { Write-Warning 'No native ARM64 build; using the amd64 build under emulation.'; return 'windows-amd64' }
        default { throw "Unsupported architecture: $arch" }
    }
}

function Invoke-Download([string] $Url, [string] $Destination) {
    for ($attempt = 1; $attempt -le 3; $attempt++) {
        try {
            Invoke-WebRequest -Uri $Url -OutFile $Destination -UseBasicParsing -TimeoutSec 600
            return
        } catch {
            Remove-Item -LiteralPath $Destination -Force -ErrorAction SilentlyContinue
            if ($attempt -eq 3) { throw "Could not download $Url after 3 attempts: $($_.Exception.Message)" }
            Write-Warning "Download attempt $attempt of 3 failed; retrying..."
            Start-Sleep -Seconds 1
        }
    }
}

# Pin one release for the binary and its checksums: two requests to the moving
# latest URL can land on different releases. GitHub redirects
# releases/latest to releases/tag/<tag>, which needs no API call.
function Resolve-ReleaseUrl {
    try {
        $request = [Net.WebRequest]::Create("https://github.com/$Repo/releases/latest"); $request.Method = 'HEAD'
        $response = $request.GetResponse()
        try { $final = $response.ResponseUri.AbsoluteUri } finally { $response.Close() }
        if ($final -match '/releases/tag/([^/?#]+)$') { return "https://github.com/$Repo/releases/download/$($Matches[1])" }
    } catch { Write-Warning "Could not resolve the latest release tag; using the latest URL." }
    return $ReleaseUrl
}

function Assert-Checksum([string] $File, [string] $AssetName, [string] $ChecksumsFile) {
    # checksums.sha256 lines look like "<hex>  <name>".
    $line = Get-Content -LiteralPath $ChecksumsFile |
        Where-Object { ($_ -split '\s+')[1] -eq $AssetName } |
        Select-Object -First 1
    if (-not $line) { throw "checksums.sha256 has no entry for $AssetName" }
    $expected = ($line -split '\s+')[0]
    $actual   = (Get-FileHash -LiteralPath $File -Algorithm SHA256).Hash
    # -ne on strings is case-insensitive in PowerShell; Get-FileHash returns
    # upper-case hex, the file has lower-case.
    if ($actual -ne $expected) { throw "Checksum mismatch for ${AssetName}: expected $expected, got $actual" }
}

function Install-Binary([string] $Asset) {
    # Private names, so two installers running at once never verify, move or
    # delete each other's downloads.
    $run       = [guid]::NewGuid().ToString('N')
    $tmp       = Join-Path $BinDir "trajectory.exe.download-$run"
    $checksums = Join-Path $BinDir "checksums.sha256.download-$run"
    $old       = $null
    try {
        $release = Resolve-ReleaseUrl
        Invoke-Download "$release/$Asset" $tmp
        Invoke-Download "$release/checksums.sha256" $checksums
        Assert-Checksum $tmp $Asset $checksums

        # Windows will not let you overwrite or delete a running .exe (a capture
        # server started by a hook may be running), but it does let you rename
        # it. Move the old one aside, then put the new one in place.
        # Earlier upgrades may have left copies that were still running then;
        # remove the ones that have exited. A unique name per upgrade means a
        # copy that is still running never blocks this one.
        Get-ChildItem -LiteralPath $BinDir -Filter 'trajectory.exe.old-*' -ErrorAction SilentlyContinue |
            Remove-Item -Force -ErrorAction SilentlyContinue
        if (Test-Path -LiteralPath $Binary) {
            $old = "$Binary.old-$(Get-Date -Format 'yyyyMMddHHmmssfff')-$run"
            Rename-Item -LiteralPath $Binary -NewName (Split-Path -Leaf $old)
        }
        try {
            Move-Item -LiteralPath $tmp -Destination $Binary -Force
        } catch {
            # Never leave the user without a trajectory.exe: put the old one back
            # unless another installer already put a new one in place.
            if ($old -and -not (Test-Path -LiteralPath $Binary) -and (Test-Path -LiteralPath $old)) {
                Rename-Item -LiteralPath $old -NewName (Split-Path -Leaf $Binary)
            }
            throw
        }
    } finally {
        Remove-Item -LiteralPath $tmp, $checksums -Force -ErrorAction SilentlyContinue
    }
}

function Add-ToUserPath([string] $Dir, [string] $KeyPath = 'Environment') {
    # The user PATH lives in the registry (HKCU\Environment). Read and write it
    # there, not from $env:Path, which is the machine and user PATH merged.
    #
    # Read the raw value: entries such as %USERPROFILE%\bin are stored
    # unexpanded in a REG_EXPAND_SZ value. [Environment]::GetEnvironmentVariable
    # returns them expanded, and writing that back would freeze every %VAR%.
    $key = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey($KeyPath)
    try {
        $raw  = $key.GetValue('Path', '', [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
        $kind = if ($key.GetValueNames() -contains 'Path') { $key.GetValueKind('Path') } else { [Microsoft.Win32.RegistryValueKind]::ExpandString }
        $entries = @($raw -split ';' | Where-Object { $_ })
        # Compare expanded and without a trailing slash, so %USERPROFILE%\.trajectory\bin
        # and C:\Users\you\.trajectory\bin\ count as the same folder.
        $norm = { param($p) [Environment]::ExpandEnvironmentVariables($p).TrimEnd('\') }
        $present = @($entries | Where-Object { (& $norm $_) -eq (& $norm $Dir) }).Count -gt 0
        if (-not $present) {
            $key.SetValue('Path', (($entries + $Dir) -join ';'), $kind)
            Write-Info "Added $Dir to your user PATH. Open a new terminal to pick it up."
        }
    } finally {
        $key.Close()
    }
    if ($KeyPath -eq 'Environment') {
        # A raw registry write does not tell running programs that the
        # environment changed, so Explorer would start new terminals with the
        # old PATH until you sign out. SetEnvironmentVariable sends that
        # notice (WM_SETTINGCHANGE); setting and clearing a throwaway variable
        # is the shortest way to make it do so without touching Path itself.
        [Environment]::SetEnvironmentVariable('TRAJECTORY_INSTALL_NOTIFY', '1', 'User')
        [Environment]::SetEnvironmentVariable('TRAJECTORY_INSTALL_NOTIFY', $null, 'User')
    }
    # Already-open terminals and apps keep their old PATH. Fix this session so
    # setup and the commands printed below work right away.
    if (($env:Path -split ';') -notcontains $Dir) { $env:Path = "$env:Path;$Dir" }
}

# ---------------------------------------------------------------------------

Write-Info 'Trajectory installer (PowerShell)'

$platform = Get-Platform
$asset    = "trajectory-$platform.exe"
Write-Info "[1/4] Detected platform: $platform"

New-Item -ItemType Directory -Force -Path $BinDir | Out-Null

# Same escape hatch as install.sh, for CI that pre-stages a fresh build.
if ($env:TRAJECTORY_SKIP_DOWNLOAD -eq '1' -or ($NonInteractive -and (Test-Path -LiteralPath $Binary))) {
    Write-Info "[2/4] Skipping download - using existing binary at $Binary"
} else {
    Write-Info '[2/4] Downloading latest release and checking its SHA-256...'
    Install-Binary $asset
}

Write-Info '[3/4] Recording install metadata and PATH...'
# selfupdate.conf tells `trajectory update` this install came from the public
# installer and may update itself. Same content as install.sh writes.
# ASCII encoding: 5.1's default for Set-Content is ANSI, and -Encoding UTF8
# would add a BOM that a Go parser may not expect.
@(
    '# Installer metadata'
    'TRAJECTORY_INSTALL_OWNER=datadog-labs'
    'TRAJECTORY_SELF_UPDATE=enabled'
    "TRAJECTORY_SELF_UPDATE_REPO=$Repo"
) | Set-Content -LiteralPath (Join-Path $InstallDir 'selfupdate.conf') -Encoding Ascii

if ($SkipPath -or $env:TRAJECTORY_INSTALL_SKIP_PATH -eq '1') {
    Write-Info "Left your user PATH unchanged. Run Trajectory as: & '$Binary'"
} else {
    Add-ToUserPath $BinDir
}

Write-Info '[4/4] Running setup...'
$setupArgs = @('setup')
if ($LocalOnly)      { $setupArgs += '--local-only' }
if ($NonInteractive) { $setupArgs += '--non-interactive' }
if ($Site)           { $setupArgs += @('--site', $Site) }
if ($MlApp)          { $setupArgs += @('--ml-app', $MlApp) }
if ($Clients)        { $setupArgs += @('--clients', $Clients) }

& $Binary @setupArgs
if ($LASTEXITCODE -ne 0) { throw "trajectory setup failed with exit code $LASTEXITCODE" }

Write-Info "Trajectory installed at $Binary"
Write-Info '  Check it:          trajectory doctor'
Write-Info '  Read the guide:    trajectory user-guide --format md install'
if ($LocalOnly) { Write-Info '  Add Datadog later: trajectory publish destination configure' }
Write-Info '  Uninstall:         trajectory uninstall'

} @args # end of & { ... }, forwarding the arguments to param()
