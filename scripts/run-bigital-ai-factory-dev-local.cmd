@echo off
setlocal EnableExtensions
title Bigital AI Factory Launcher

cd /d "%~dp0.."
set "REPO_DIR=%cd%"

echo [Bigital AI Factory] Preparing startup from %REPO_DIR%
echo [Bigital AI Factory] Cleaning previous Bigital AI Factory dev processes...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0kill-bigital-ai-factory-dev.ps1" -RepoDir "%REPO_DIR%"

echo [Bigital AI Factory] Starting v2.0.2...
corepack pnpm dev:local
echo.
echo [Bigital AI Factory] Exited with code %ERRORLEVEL%
pause
