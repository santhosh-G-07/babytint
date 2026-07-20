$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $root "backend"
$pythonExe = Join-Path $backendDir ".venv\Scripts\python.exe"
$port = 8000

function Stop-PortListeners {
    param([int]$Port)
    $listenerPids = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($listenerPid in $listenerPids) {
        Stop-Process -Id $listenerPid -Force -ErrorAction SilentlyContinue
    }
}

function Invoke-Api {
    param(
        [string]$Method,
        [string]$Path,
        [string]$Body = "",
        [hashtable]$Headers = @{},
        [string]$ContentType = "application/json"
    )

    $url = "http://127.0.0.1:$port$Path"
    try {
        if ($Method -eq "GET") {
            $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 20 -Method Get -Headers $Headers
        } elseif ($Method -eq "POST") {
            if ($Body -ne "") {
                $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 20 -Method Post -Body $Body -ContentType $ContentType -Headers $Headers
            } else {
                $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 20 -Method Post -Headers $Headers
            }
        } elseif ($Method -eq "PUT") {
            $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 20 -Method Put -Body $Body -ContentType $ContentType -Headers $Headers
        } elseif ($Method -eq "PATCH") {
            if ($Body -eq "") {
                $Body = "{}"
            }
            $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 20 -Method Patch -Body $Body -ContentType $ContentType -Headers $Headers
        } elseif ($Method -eq "DELETE") {
            $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 20 -Method Delete -Headers $Headers
        } else {
            return [PSCustomObject]@{
                Code = -1
                Body = "Unsupported method: $Method"
            }
        }
        return [PSCustomObject]@{
            Code = [int]$response.StatusCode
            Body = ($response.Content | Out-String).Trim()
        }
    } catch {
        if ($_.Exception.Response) {
            $stream = $_.Exception.Response.GetResponseStream()
            if ($stream) {
                $reader = New-Object IO.StreamReader($stream)
                $errorBody = $reader.ReadToEnd()
                $reader.Close()
            } else {
                $errorBody = ""
            }
            return [PSCustomObject]@{
                Code = [int]$_.Exception.Response.StatusCode
                Body = $errorBody
            }
        }
        return [PSCustomObject]@{
            Code = -1
            Body = $_.Exception.Message
        }
    }
}

function Wait-ForHealth {
    param([int]$Port, [int]$MaxAttempts = 20)
    for ($i = 0; $i -lt $MaxAttempts; $i++) {
        try {
            $res = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/health" -UseBasicParsing -TimeoutSec 3
            if ($res.StatusCode -eq 200) {
                return $true
            }
        } catch {}
        Start-Sleep -Milliseconds 500
    }
    return $false
}

if (-not (Test-Path $pythonExe)) {
    Write-Error "Backend virtual environment not found at $pythonExe. Run npm run dev:install first."
    exit 1
}

Stop-PortListeners -Port $port

$backendProc = Start-Process `
    -FilePath $pythonExe `
    -ArgumentList "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", $port `
    -WorkingDirectory $backendDir `
    -WindowStyle Hidden `
    -PassThru

try {
    if (-not (Wait-ForHealth -Port $port)) {
        Write-Error "Backend did not become healthy on port $port."
        exit 1
    }

    $dummyUuid = "11111111-1111-1111-1111-111111111111"
    $frameCreateBody = '{"name":"Test","slug":"test-slug","description":"d","category":"classic","size":"8x10","price":"999.00","offer_price":"899.00","frame_asset_url":"http://example.com/x.png","preview_asset_url":"http://example.com/p.png","slot_positions":[]}'
    $frameUpdateBody = '{"name":"Updated"}'
    $checkoutBody = "{`"delivery_address`":{`"line1`":`"221B Baker Street`"},`"items`":[{`"frame_id`":`"$dummyUuid`",`"quantity`":1,`"customization_data`":{`"frame_id`":`"$dummyUuid`",`"slots`":[]}}]}"
    $cartBody = "{`"frame_id`":`"$dummyUuid`",`"customization_data`":{`"frame_id`":`"$dummyUuid`",`"slots`":[]}}"
    $paymentCreateBody = "{`"order_id`":`"$dummyUuid`"}"
    $orderStatusBody = '{"status":"printing","tracking_link":"https://example.com/track"}'

    $unauthChecks = @(
        @{ Method = "GET"; Path = "/health"; Expected = 200; Name = "health" },
        @{ Method = "GET"; Path = "/api/frames"; Expected = 200; Name = "list frames" },
        @{ Method = "GET"; Path = "/api/frames/white-12x8-frame"; Expected = 200; Name = "get frame by slug" },
        @{ Method = "GET"; Path = "/api/frames/not-a-real-frame"; Expected = 404; Name = "get missing frame" },
        @{ Method = "GET"; Path = "/api/auth/me"; Expected = 401; Name = "auth me unauth" },
        @{ Method = "POST"; Path = "/api/upload/image"; Expected = 422; Name = "upload image missing file" },
        @{ Method = "POST"; Path = "/api/upload/frame"; Expected = 401; Name = "upload frame unauth" },
        @{ Method = "POST"; Path = "/api/payment/create-order"; Expected = 401; Name = "payment create-order unauth"; Body = $paymentCreateBody },
        @{ Method = "POST"; Path = "/api/payment/webhook"; Expected = 200; Name = "payment webhook empty body"; Body = "{}" },
        @{ Method = "GET"; Path = "/api/orders/me"; Expected = 401; Name = "orders me unauth" },
        @{ Method = "GET"; Path = "/api/orders/admin/all"; Expected = 401; Name = "orders admin all unauth" },
        @{ Method = "POST"; Path = "/api/orders/checkout"; Expected = 401; Name = "checkout unauth"; Body = $checkoutBody },
        @{ Method = "PATCH"; Path = "/api/orders/$dummyUuid/status"; Expected = 401; Name = "order status patch unauth"; Body = $orderStatusBody },
        @{ Method = "GET"; Path = "/api/orders/cart"; Expected = 401; Name = "cart list unauth" },
        @{ Method = "POST"; Path = "/api/orders/cart"; Expected = 401; Name = "cart add unauth"; Body = $cartBody },
        @{ Method = "DELETE"; Path = "/api/orders/cart/$dummyUuid"; Expected = 401; Name = "cart delete unauth" },
        @{ Method = "POST"; Path = "/api/frames"; Expected = 401; Name = "create frame unauth"; Body = $frameCreateBody },
        @{ Method = "PUT"; Path = "/api/frames/$dummyUuid"; Expected = 401; Name = "update frame unauth"; Body = $frameUpdateBody },
        @{ Method = "DELETE"; Path = "/api/frames/$dummyUuid"; Expected = 401; Name = "delete frame unauth" },
        @{ Method = "GET"; Path = "/api/admin/dashboard"; Expected = 401; Name = "admin dashboard unauth" }
    )

    Write-Output ""
    Write-Output "Unauthenticated endpoint checks:"
    $failures = 0
    foreach ($check in $unauthChecks) {
        $body = if ($check.ContainsKey("Body")) { [string]$check.Body } else { "" }
        $result = Invoke-Api -Method $check.Method -Path $check.Path -Body $body
        $pass = ($result.Code -eq [int]$check.Expected)
        $marker = if ($pass) { "PASS" } else { "FAIL" }
        Write-Output "[$marker] $($check.Method) $($check.Path) expected=$($check.Expected) actual=$($result.Code) ($($check.Name))"
        if (-not $pass) {
            $failures++
            if ($result.Body) {
                Write-Output "  body: $($result.Body)"
            }
        }
    }

    Write-Output ""
    Write-Output "Fake-token checks (must not be 500):"
    $authHeaders = @{ Authorization = "Bearer fake-token" }
    foreach ($path in @("/api/auth/me", "/api/orders/cart", "/api/admin/dashboard")) {
        $result = Invoke-Api -Method "GET" -Path $path -Headers $authHeaders
        $pass = ($result.Code -ne 500 -and $result.Code -ne -1)
        $marker = if ($pass) { "PASS" } else { "FAIL" }
        Write-Output "[$marker] GET $path actual=$($result.Code)"
        if (-not $pass) {
            $failures++
            if ($result.Body) {
                Write-Output "  body: $($result.Body)"
            }
        }
    }

    Write-Output ""
    Write-Output "Upload success check (/api/upload/image with a tiny PNG):"
    $uploadCode = & $pythonExe -c @"
import httpx
png = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\x0cIDATx\x9cc```\x00\x00\x00\x04\x00\x01\x0b\xe7\x9d\xb3\x00\x00\x00\x00IEND\xaeB`\x82'
r = httpx.post('http://127.0.0.1:8000/api/upload/image', files={'file': ('tiny.png', png, 'image/png')}, timeout=20)
print(r.status_code)
"@

    $uploadStatus = [int]($uploadCode | Select-Object -Last 1)
    $uploadPass = ($uploadStatus -eq 200)
    $uploadMarker = if ($uploadPass) { "PASS" } else { "FAIL" }
    Write-Output "[$uploadMarker] POST /api/upload/image actual=$uploadStatus"
    if (-not $uploadPass) {
        $failures++
    }

    Write-Output ""
    Write-Output "Summary: total checks=$($unauthChecks.Count + 3 + 1), failures=$failures"
    if ($failures -gt 0) {
        exit 1
    }
} finally {
    if ($backendProc -and (Get-Process -Id $backendProc.Id -ErrorAction SilentlyContinue)) {
        Stop-Process -Id $backendProc.Id -Force -ErrorAction SilentlyContinue
    }
    Stop-PortListeners -Port $port
}
