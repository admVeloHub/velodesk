# v1.2.0 — Sobe só o frontend Velodesk (npm start)
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force | Out-Null
$env:Path = "C:\Program Files\nodejs;C:\Program Files\Git\cmd;" + $env:Path
Set-Location "$PSScriptRoot\frontend"
& "C:\Program Files\nodejs\npm.cmd" start
