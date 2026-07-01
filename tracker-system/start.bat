@echo off
REM ===== IT Asset Tracker - one-click launcher (LAN / localhost, plain HTTP) =====
setlocal
cd /d "%~dp0"

set PORT=3000
REM serve built client on one port; plain-HTTP cookie (no HTTPS needed on LAN)
set SERVE_STATIC=true
set COOKIE_SECURE=false

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found. Install Node 20+ from https://nodejs.org
  pause
  exit /b 1
)

netstat -ano | findstr ":%PORT% " | findstr LISTENING >nul
if not errorlevel 1 (
  echo [ERROR] Port %PORT% already in use ^(another server running^).
  echo         Close it, or change PORT at top of this file.
  pause
  exit /b 1
)

if not exist ".env" (
  echo [setup] creating .env from .env.example
  copy /y ".env.example" ".env" >nul
)

if not exist "node_modules" (
  echo [setup] installing dependencies ^(first run, ~1 min^)...
  call npm install || (echo [ERROR] npm install failed & pause & exit /b 1)
)

if not exist "client\dist\index.html" (
  echo [setup] building web client...
  call npm run build || (echo [ERROR] build failed & pause & exit /b 1)
)

echo.
echo ============================================================
echo   IT Asset Tracker starting on http://localhost:%PORT%
echo   Sign in with your IT account. Close this window to stop the server.
echo ============================================================
echo.

REM open browser after a short delay, then run server in this window
start "" /b cmd /c "timeout /t 3 >nul & start http://localhost:%PORT%"
node server\src\index.js

pause
