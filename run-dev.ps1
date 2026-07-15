# run-dev.ps1 v1.4.0 — instala deps se necessário e sobe backend + frontend (npm start)
# VERSION: v1.4.0 | DATE: 2026-07-14 | AUTHOR: VeloHub Development Team
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force | Out-Null
$env:Path = "C:\Program Files\nodejs;C:\Program Files\Git\cmd;" + $env:Path
$npm = "C:\Program Files\nodejs\npm.cmd"
$root = $PSScriptRoot
& "$root\stop-dev.ps1"

if (-not (Test-Path "$root\backend\node_modules")) {
  Write-Host "Instalando dependências do backend..."
  & $npm install --prefix "$root\backend"
}
if (-not (Test-Path "$root\frontend\node_modules")) {
  Write-Host "Instalando dependências do frontend..."
  & $npm install --prefix "$root\frontend"
}

Set-Location $root
& $npm start
