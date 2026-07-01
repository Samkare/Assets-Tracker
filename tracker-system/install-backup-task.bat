@echo off
REM ============================================================
REM  One-time setup: register the nightly DB backup as a
REM  Windows Scheduled Task (runs every day at 02:00).
REM
REM  >>> RIGHT-CLICK this file and choose "Run as administrator" <<<
REM ============================================================
cd /d "%~dp0"

echo Registering scheduled task "ITAssetTracker-Backup" (daily 02:00)...
schtasks /create /tn "ITAssetTracker-Backup" /tr "\"%~dp0backup.bat\"" /sc daily /st 02:00 /rl highest /f
if errorlevel 1 (
  echo.
  echo *** FAILED. You must run this file AS ADMINISTRATOR. ***
  echo Right-click install-backup-task.bat -^> Run as administrator.
  pause
  exit /b 1
)

echo.
echo Task registered. Running it once now to verify a backup lands...
schtasks /run /tn "ITAssetTracker-Backup"
timeout /t 4 /nobreak >nul

echo.
echo Newest files in data\backups:
dir /b /o-d "data\backups\*.db" 2>nul

echo.
echo Done. A fresh app-<timestamp>.db above means it works.
echo The task will now run automatically every night at 02:00.
pause
