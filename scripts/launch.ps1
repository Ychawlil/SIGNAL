# SIGNAL launcher (used by the desktop shortcut).
#
# ASCII-only on purpose: the project path contains non-ASCII characters, so the
# path is derived from $PSScriptRoot instead of being written into this file.
# The port is read from package.json ("dev": "next dev -p 2026") so the shortcut
# keeps working when the port changes.
#
# Every step is appended to %TEMP%\signal-launch.log, and any unhandled error is
# reported in a message box, so a failing double-click is never silent.

$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$logPath = Join-Path $env:TEMP 'signal-launch.log'

function Write-Log([string]$message) {
    try {
        $line = '{0}  {1}' -f (Get-Date -Format 'HH:mm:ss'), $message
        Add-Content -LiteralPath $logPath -Value $line -Encoding UTF8
    } catch {
        # Logging must never become the reason the launcher fails.
    }
}

function Show-SignalMessage([string]$text, [string]$icon) {
    try {
        Add-Type -AssemblyName PresentationFramework
        [System.Windows.MessageBox]::Show($text, 'SIGNAL', 'OK', $icon) | Out-Null
    } catch {
        Write-Log "message box failed: $($_.Exception.Message)"
    }
}

function Get-SignalPort {
    $packageJson = Join-Path $project 'package.json'
    if (Test-Path -LiteralPath $packageJson) {
        try {
            $package = Get-Content -Raw -LiteralPath $packageJson | ConvertFrom-Json
            $devScript = [string]$package.scripts.dev
            if ($devScript -match '(--port|-p)\s*=?\s*(\d{2,5})') {
                return [int]$Matches[2]
            }
        } catch {
            Write-Log "could not parse package.json: $($_.Exception.Message)"
        }
    }
    return 3000
}

function Test-PortOpen([int]$targetPort) {
    # Fast, dependency-free reachability check: a refused connection returns in
    # milliseconds, whereas an HTTP probe on localhost takes ~4s in PowerShell.
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $async = $client.BeginConnect('127.0.0.1', $targetPort, $null, $null)
        if (-not $async.AsyncWaitHandle.WaitOne(400)) { return $false }
        $client.EndConnect($async)
        return $true
    } catch {
        return $false
    } finally {
        $client.Close()
    }
}

function Test-SignalUp([string]$target, [int]$targetPort) {
    if (-not (Test-PortOpen $targetPort)) { return $false }
    # The port is open; confirm it actually serves HTTP 2xx. WebClient throws on
    # 4xx/5xx, which here just means "still compiling". A null proxy avoids the
    # system-proxy lookup that breaks localhost requests.
    try {
        $client = New-Object System.Net.WebClient
        $client.Proxy = $null
        $data = $client.DownloadData($target)
        return ($null -ne $data -and $data.Length -gt 0)
    } catch {
        return $false
    }
}

<#
  Next dev compiles each route on its first request. Opening the browser as soon
  as GET / answers therefore shows the shell with zeroed counters for tens of
  seconds, which reads as "broken". Touching the routes the home page needs makes
  the first paint complete. Best effort: a failure only costs time, never data.
#>
function Invoke-SignalWarmup {
    $routes = @(
        '/api/universe',
        '/api/signals/stats',
        '/api/briefing?count=1',
        '/api/signals?pageSize=100&sort=importance',
        '/api/trends?range=7d'
    )
    $client = New-Object System.Net.WebClient
    $client.Proxy = $null
    $client.Headers.Add('User-Agent', 'SIGNAL-launcher')
    foreach ($route in $routes) {
        $target = "http://localhost:$script:signalPort$route"
        $watch = [System.Diagnostics.Stopwatch]::StartNew()
        try {
            $null = $client.DownloadData($target)
            $watch.Stop()
            Write-Log ("warm {0} {1:N1}s" -f $route, $watch.Elapsed.TotalSeconds)
        } catch {
            $watch.Stop()
            Write-Log ("warm {0} failed after {1:N1}s: {2}" -f $route, $watch.Elapsed.TotalSeconds, $_.Exception.Message)
        }
    }
}

function Start-Signal {
    $port = Get-SignalPort
    $script:signalPort = $port
    $url = "http://localhost:$port/"
    $readyTimeoutSeconds = 120
    Write-Log "port=$port url=$url"

    if (Test-SignalUp $url $port) {
        Write-Log 'site already running; opening browser only'
        Start-Process $url
        return 0
    }

    # Only one launcher may start a server. A second double-click while the
    # first is still booting waits for that one instead of spawning a duplicate
    # `npm run dev` that would lose the port race and die.
    $mutex = New-Object System.Threading.Mutex($false, 'Local\SignalLauncher')
    $ownsMutex = $false
    try {
        try {
            $ownsMutex = $mutex.WaitOne(0)
        } catch [System.Threading.AbandonedMutexException] {
            # A previous launcher was killed mid-start; we inherit the lock.
            $ownsMutex = $true
        }

        if (-not $ownsMutex) {
            Write-Log 'another launcher is already starting the server; waiting for it'
            for ($attempt = 0; $attempt -lt $readyTimeoutSeconds; $attempt++) {
                Start-Sleep -Seconds 1
                if (Test-SignalUp $url $port) {
                    Write-Log "opened by the other launcher after $($attempt + 1)s"
                    Start-Process $url
                    return 0
                }
            }
            Write-Log 'gave up waiting for the other launcher'
            Show-SignalMessage ("SIGNAL is still starting.`n`nLog: $logPath") 'Warning'
            return 1
        }

        return Wait-ForSignal $url $port $readyTimeoutSeconds
    } finally {
        if ($ownsMutex) {
            try { $mutex.ReleaseMutex() } catch { Write-Log "mutex release failed: $($_.Exception.Message)" }
        }
        $mutex.Dispose()
    }
}

function Wait-ForSignal([string]$url, [int]$port, [int]$readyTimeoutSeconds) {
    $packageJson = Join-Path $project 'package.json'
    if (-not (Test-Path -LiteralPath $packageJson)) {
        Write-Log 'package.json missing'
        Show-SignalMessage "package.json not found in:`n$project" 'Error'
        return 1
    }

    # npm is a .cmd shim, so it must run through cmd.exe. Start-Process creates
    # an independent process, so the server outlives this launcher.
    Write-Log "starting: cmd.exe /c npm run dev (cwd: $project)"
    $server = Start-Process -FilePath "$env:ComSpec" `
        -ArgumentList '/c', 'title SIGNAL dev server && npm run dev' `
        -WorkingDirectory $project `
        -WindowStyle Minimized `
        -PassThru `
        -ErrorAction Stop
    Write-Log "server launcher pid=$($server.Id)"

    for ($attempt = 0; $attempt -lt $readyTimeoutSeconds; $attempt++) {
        Start-Sleep -Seconds 1
        if (Test-SignalUp $url $port) {
            Write-Log "shell ready after $($attempt + 1)s; warming data routes"
            Invoke-SignalWarmup
            Write-Log 'opening browser'
            Start-Process $url
            return 0
        }
        if ($server.HasExited) {
            Write-Log "dev server exited early (code $($server.ExitCode))"
            break
        }
    }

    Write-Log 'timed out or server exited before responding'
    Show-SignalMessage ("SIGNAL did not start.`n`nLog: $logPath`n`nOr open a terminal in:`n$project`nand run: npm run dev") 'Warning'
    return 1
}

Set-Content -LiteralPath $logPath -Value "--- SIGNAL launcher --- project: $project" -Encoding UTF8
Write-Log "powershell $($PSVersionTable.PSVersion)"

try {
    exit (Start-Signal)
} catch {
    Write-Log "UNHANDLED: $($_.Exception.GetType().Name): $($_.Exception.Message)"
    Write-Log "at: $($_.InvocationInfo.PositionMessage)"
    Show-SignalMessage ("SIGNAL launcher failed.`n`n$($_.Exception.Message)`n`nLog: $logPath") 'Error'
    exit 1
}
