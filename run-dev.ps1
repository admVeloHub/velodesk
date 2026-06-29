# run-dev.ps1 v1.2.0 — libera portas e sobe backend + frontend (npm start em cada pasta)
# VERSION: v1.2.0 | DATE: 2026-06-29 | AUTHOR: VeloHub Development Team
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force | Out-Null
$root = $PSScriptRoot
& "$root\stop-dev.ps1"
$psArgs = @("-NoExit", "-ExecutionPolicy", "Bypass", "-Command")
Start-Process powershell -ArgumentList ($psArgs + "Set-Location '$root\backend'; npm start")
Start-Sleep -Seconds 2
Start-Process powershell -ArgumentList @("-NoExit", "-ExecutionPolicy", "Bypass", "-File", "$root\start-frontend.ps1")
Write-Host "Backend: http://localhost:8001 | Frontend: http://localhost:8000/tickets?desk=v2"
