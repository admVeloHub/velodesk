# run-dev.ps1 v1.3.0 — libera portas, instala deps se necessário e sobe backend + frontend
# VERSION: v1.3.0 | DATE: 2026-07-08 | AUTHOR: VeloHub Development Team
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force | Out-Null
$env:Path = "C:\Program Files\nodejs;C:\Program Files\Git\cmd;" + $env:Path
$root = $PSScriptRoot
& "$root\stop-dev.ps1"

if (-not (Test-Path "$root\backend\node_modules")) {
  Write-Host "Instalando dependências do backend..."
  & npm install --prefix "$root\backend"
}
if (-not (Test-Path "$root\frontend\node_modules")) {
  Write-Host "Instalando dependências do frontend..."
  & npm install --prefix "$root\frontend"
}

$psArgs = @("-NoExit", "-ExecutionPolicy", "Bypass", "-Command")
Start-Process powershell -ArgumentList ($psArgs + "Set-Location '$root\backend'; npm start")
Start-Sleep -Seconds 4
Start-Process powershell -ArgumentList @("-NoExit", "-ExecutionPolicy", "Bypass", "-File", "$root\start-frontend.ps1")
Write-Host "Backend: http://localhost:8001 | Frontend: http://localhost:8000/tickets?desk=v2"
