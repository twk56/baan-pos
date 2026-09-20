$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
try {
    $taskResponse = Invoke-WebRequest -Uri 'http://localhost:3000' -TimeoutSec 2 -UseBasicParsing
    if ($taskResponse.Content -match 'Baan POS') { Start-Process 'http://localhost:3000'; exit }
} catch {}
$taskNode = (Get-Command node -ErrorAction Stop).Source
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'node_modules'))) { npm.cmd ci; if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed' } }
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'dist/index.html'))) { npm.cmd run build; if ($LASTEXITCODE -ne 0) { throw 'Build failed' } }
Start-Process -FilePath $taskNode -ArgumentList 'server/index.js' -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $PSScriptRoot 'server.log') -RedirectStandardError (Join-Path $PSScriptRoot 'server-error.log')
for ($taskAttempt = 0; $taskAttempt -lt 20; $taskAttempt++) {
    try { $taskResponse = Invoke-WebRequest -Uri 'http://localhost:3000' -TimeoutSec 2 -UseBasicParsing; if ($taskResponse.StatusCode -eq 200) { Start-Process 'http://localhost:3000'; exit } } catch { Start-Sleep -Milliseconds 300 }
}
throw 'POS could not start. Please check server-error.log.'
