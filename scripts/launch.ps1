# SIGNAL launcher (used by the desktop shortcut).
#
# ASCII-only on purpose: the project path contains non-ASCII characters, so the
# path is derived from $PSScriptRoot instead of being written into this file.
# The port is read from package.json ("dev": "next dev -p 2026") so the
# shortcut keeps working when the port changes.
#
# Behaviour:
#   1. If the site already answers, just open the browser.
#   2. Otherwise start `npm run dev` in a minimised console, wait until it
#      responds, then open the browser. Closing that console stops the server.

$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot

function Get-SignalPort {
    $packageJson = Join-Path $project 'package.json'
    if (Test-Path $packageJson) {
        try {
            $package = Get-Content -Raw -LiteralPath $packageJson | ConvertFrom-Json
            $devScript = [string]$package.scripts.dev
            if ($devScript -match '(--port|-p)\s*=?\s*(\d{2,5})') {
                return [int]$Matches[2]
            }
        } catch {
            # Fall through to the default below.
        }
    }
    return 3000
}

$port = Get-SignalPort
$url = "http://localhost:$port/"
$readyTimeoutSeconds = 120

function Test-SignalUp {
    try {
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3
        return ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500)
    } catch {
        return $false
    }
}

function Show-SignalMessage([string]$text, [string]$icon) {
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show($text, 'SIGNAL', 'OK', $icon) | Out-Null
}

if (Test-SignalUp) {
    Start-Process $url
    exit 0
}

if (-not (Test-Path (Join-Path $project 'package.json'))) {
    Show-SignalMessage "package.json not found in:`n$project" 'Error'
    exit 1
}

Start-Process -FilePath 'cmd.exe' `
    -ArgumentList '/c', 'npm run dev' `
    -WorkingDirectory $project `
    -WindowStyle Minimized

for ($attempt = 0; $attempt -lt $readyTimeoutSeconds; $attempt++) {
    Start-Sleep -Seconds 1
    if (Test-SignalUp) {
        Start-Process $url
        exit 0
    }
}

Show-SignalMessage ("SIGNAL did not become ready at $url within $readyTimeoutSeconds seconds.`n`nOpen a terminal in:`n$project`nand run: npm run dev`n`nto see the error output.") 'Warning'
exit 1
