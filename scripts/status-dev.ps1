$ErrorActionPreference = "Stop"

$ports = @(
    @{ Port = 3000; Name = "frontend" },
    @{ Port = 3001; Name = "frontend" },
    @{ Port = 8000; Name = "backend" },
    @{ Port = 8001; Name = "backend" }
)

foreach ($entry in $ports) {
    $listenerPid = Get-NetTCPConnection -LocalPort $entry.Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -First 1 -ExpandProperty OwningProcess

    if ($listenerPid) {
        $proc = Get-Process -Id $listenerPid -ErrorAction SilentlyContinue
        $name = if ($proc) { $proc.ProcessName } else { "unknown" }
        Write-Host "$($entry.Name) port $($entry.Port): RUNNING (PID $listenerPid, $name)"
    } else {
        Write-Host "$($entry.Name) port $($entry.Port): stopped"
    }
}
