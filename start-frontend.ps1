# v1.1.0 — Sobe o frontend Velodesk (npm start na raiz ou aqui)
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force | Out-Null
$env:Path = "C:\Program Files\nodejs;C:\Program Files\Git\cmd;" + $env:Path
Set-Location $PSScriptRoot
if (Test-Path ".\package.json") {
  & "C:\Program Files\nodejs\npm.cmd" start
} else {
  Set-Location $PSScriptRoot\frontend
  & "C:\Program Files\nodejs\npm.cmd" start
}
