param([string]$OutputDir = "./backups")
$ErrorActionPreference = 'Stop'
$db = if ($env:DB_PATH) { $env:DB_PATH } else { './data/pos.sqlite' }
if (-not (Test-Path -LiteralPath $db)) { throw "Database not found: $db" }
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$target = Join-Path $OutputDir "pos-$stamp.sqlite"
Copy-Item -LiteralPath $db -Destination $target
Get-ChildItem -LiteralPath $OutputDir -Filter '*.sqlite' | Sort-Object LastWriteTime -Descending | Select-Object -Skip 14 | Remove-Item -Force
Write-Output "Backup created: $target"
