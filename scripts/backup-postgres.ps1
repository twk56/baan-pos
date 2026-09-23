param([string]$OutputDir = "./backups", [switch]$RestoreTest)
$ErrorActionPreference = 'Stop'
if (-not $env:DATABASE_URL) { throw 'DATABASE_URL is required' }
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$target = Join-Path $OutputDir "baan-pos-$stamp.dump"
& pg_dump $env:DATABASE_URL --format=custom --no-owner --file=$target
if ($LASTEXITCODE -ne 0) { throw 'pg_dump failed' }
if ($env:BACKUP_ENCRYPTION_KEY) { & openssl enc -aes-256-cbc -pbkdf2 -salt -in $target -out "$target.enc" -pass env:BACKUP_ENCRYPTION_KEY; Remove-Item $target }
Get-ChildItem $OutputDir -Filter '*.dump*' | Sort-Object LastWriteTime -Descending | Select-Object -Skip 14 | Remove-Item -Force
if ($RestoreTest) { if ($env:BACKUP_ENCRYPTION_KEY) { throw 'RestoreTest requires a disposable DB and encrypted restore command' }; & pg_restore --list $target | Out-Null; if ($LASTEXITCODE -ne 0) { throw 'restore validation failed' } }
Write-Output "PostgreSQL backup created: $target"
