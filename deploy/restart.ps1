# Restart the SafeJunction service on the GPU server (called by the deploy workflow).
$ErrorActionPreference = "SilentlyContinue"
Get-CimInstance Win32_Process | Where-Object {
    ($_.Name -eq "python.exe" -and ($_.CommandLine -like "*deploy\serve.py*" -or $_.CommandLine -like "*doppix-safejunction\backend*")) -or
    ($_.Name -eq "cloudflared.exe" -and $_.CommandLine -like "*7870*")
} | ForEach-Object { Stop-Process -Id $_.ProcessId -Force; "stopped $($_.Name) $($_.ProcessId)" }
schtasks /End /TN SafeJunction | Out-Null
Start-Sleep 2
schtasks /Run /TN SafeJunction | Out-Null
for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep 3
    try { $h = Invoke-WebRequest -UseBasicParsing http://127.0.0.1:7870/api/health; "backend up: $($h.Content)"; exit 0 } catch {}
}
"backend did not come up"; exit 1
