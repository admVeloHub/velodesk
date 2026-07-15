# stop-dev.ps1 v1.1.0 — libera portas Velodesk 8000/8001 (somente node)
# VERSION: v1.1.0 | DATE: 2026-06-24 | AUTHOR: VeloHub Development Team
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force | Out-Null
$env:Path = "C:\Program Files\nodejs;" + $env:Path
& node "$PSScriptRoot\scripts\free-port.cjs" 8000 8001
Write-Host "Pronto. Rode .\start.cmd, npm.cmd start ou .\run-dev.ps1"
