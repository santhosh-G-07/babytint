$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$runDir = Join-Path $root ".run"

function Stop-ByPidFile {
    param([string]$Name)
    $pidFile = Join-Path $runDir "$Name.pid"
    if (-not (Test-Path $pidFile)) {
        return
    }

    try {
        $procId = [int](Get-Content $pidFile)
        $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
        if ($proc) {
            Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
            Write-Host "Stopped $Name PID $procId"
        }
    } catch {
        Write-Host "Could not stop $Name from pid file."
    } finally {
        Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    }
}

function Stop-ByPort {
    param(
        [int]$Port,
        [string]$Label
    )
    $listenerPids = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($listenerPid in $listenerPids) {
        Stop-Process -Id $listenerPid -Force -ErrorAction SilentlyContinue
        Write-Host "Stopped $Label on port $Port (PID $listenerPid)"
    }
}

Stop-ByPidFile -Name "frontend"
Stop-ByPidFile -Name "backend"

Stop-ByPort -Port 3000 -Label "frontend"
Stop-ByPort -Port 3001 -Label "frontend"
Stop-ByPort -Port 8000 -Label "backend"
Stop-ByPort -Port 8001 -Label "backend"

Write-Host "Done."
