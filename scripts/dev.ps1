param(
    [int]$FrontendPort = 3001,
    [int]$BackendPort = 8000,
    [switch]$Install
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$runDir = Join-Path $root ".run"
$logDir = Join-Path $root ".logs"
$backendDir = Join-Path $root "backend"
$frontendDir = Join-Path $root "frontend"
$backendPython = Join-Path $backendDir ".venv\\Scripts\\python.exe"

New-Item -ItemType Directory -Force -Path $runDir | Out-Null
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Stop-ByPidFile {
    param([string]$Name)
    $pidFile = Join-Path $runDir "$Name.pid"
    if (-not (Test-Path $pidFile)) {
        return
    }

    try {
        $raw = Get-Content $pidFile -ErrorAction SilentlyContinue
        $procId = [int]$raw
        $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
        if ($proc) {
            Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        }
    } catch {
        # ignore malformed pid file
    } finally {
        Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    }
}

function Stop-ByPort {
    param([int]$Port)
    $listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($listenerPid in $listeners) {
        Stop-Process -Id $listenerPid -Force -ErrorAction SilentlyContinue
    }
}

Stop-ByPidFile -Name "frontend"
Stop-ByPidFile -Name "backend"
Stop-ByPort -Port $FrontendPort
Stop-ByPort -Port $BackendPort

if (-not (Test-Path $backendPython)) {
    Write-Output "Creating backend virtual environment..."
    python -m venv (Join-Path $backendDir ".venv")
}

$needsBackendInstall = $Install
if (-not $needsBackendInstall) {
    try {
        & $backendPython -c "import uvicorn" *> $null
    } catch {
        $needsBackendInstall = $true
    }
}

if ($needsBackendInstall) {
    Write-Output "Installing backend dependencies..."
    & $backendPython -m pip install -r (Join-Path $backendDir "requirements.txt")
}

$nextCmd = Join-Path $frontendDir "node_modules\\.bin\\next.cmd"
if ($Install -or -not (Test-Path $nextCmd)) {
    Write-Output "Installing frontend dependencies..."
    npm --prefix $frontendDir install
}

$backendOut = Join-Path $logDir "backend.out.log"
$backendErr = Join-Path $logDir "backend.err.log"
$frontendOut = Join-Path $logDir "frontend.out.log"
$frontendErr = Join-Path $logDir "frontend.err.log"

foreach ($logFile in @($backendOut, $backendErr, $frontendOut, $frontendErr)) {
    if (Test-Path $logFile) {
        Remove-Item $logFile -Force -ErrorAction SilentlyContinue
    }
}

$backendProc = Start-Process `
    -FilePath $backendPython `
    -ArgumentList "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", $BackendPort `
    -WorkingDirectory $backendDir `
    -WindowStyle Hidden `
    -RedirectStandardOutput $backendOut `
    -RedirectStandardError $backendErr `
    -PassThru

$frontendCommand = "Set-Location '$frontendDir'; `$env:PORT='$FrontendPort'; npm run dev"
$frontendProc = Start-Process `
    -FilePath "powershell.exe" `
    -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $frontendCommand `
    -WorkingDirectory $frontendDir `
    -WindowStyle Hidden `
    -RedirectStandardOutput $frontendOut `
    -RedirectStandardError $frontendErr `
    -PassThru

Set-Content -Path (Join-Path $runDir "backend.pid") -Value $backendProc.Id
Set-Content -Path (Join-Path $runDir "frontend.pid") -Value $frontendProc.Id

Start-Sleep -Seconds 3

$backendOk = $false
$frontendOk = $false
$backendListenerPid = $null
$frontendListenerPid = $null

try {
    $null = Invoke-WebRequest -Uri "http://127.0.0.1:$BackendPort/health" -UseBasicParsing -TimeoutSec 5
    $backendOk = $true
} catch {}

try {
    $null = Invoke-WebRequest -Uri "http://127.0.0.1:$FrontendPort" -UseBasicParsing -TimeoutSec 8
    $frontendOk = $true
} catch {}

$backendListenerPid = Get-NetTCPConnection -LocalPort $BackendPort -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty OwningProcess
$frontendListenerPid = Get-NetTCPConnection -LocalPort $FrontendPort -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty OwningProcess

if ($backendListenerPid) {
    Set-Content -Path (Join-Path $runDir "backend.pid") -Value $backendListenerPid
}
if ($frontendListenerPid) {
    Set-Content -Path (Join-Path $runDir "frontend.pid") -Value $frontendListenerPid
}

$backendDisplayPid = if ($backendListenerPid) { $backendListenerPid } else { $backendProc.Id }
$frontendDisplayPid = if ($frontendListenerPid) { $frontendListenerPid } else { $frontendProc.Id }

Write-Output ""
Write-Output "Started BabyTint dev services:"
Write-Output "Backend  PID: $backendDisplayPid  URL: http://127.0.0.1:$BackendPort  Health: $backendOk"
Write-Output "Frontend PID: $frontendDisplayPid  URL: http://127.0.0.1:$FrontendPort  Reachable: $frontendOk"
Write-Output ""
Write-Output "Logs:"
Write-Output "  $backendOut"
Write-Output "  $backendErr"
Write-Output "  $frontendOut"
Write-Output "  $frontendErr"
Write-Output ""
Write-Output "Stop both:"
Write-Output "  npm run dev:stop"
