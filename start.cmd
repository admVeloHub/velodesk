@echo off
REM Velodesk — sobe backend + frontend (evita bloqueio do npm.ps1 no PowerShell)
cd /d "%~dp0"
call npm.cmd start
