@echo off
REM Nightly DB backup -> data\backups\app-<timestamp>.db (keeps last 30).
REM Scheduled via Windows Task Scheduler. cd ensures .env loads from repo root.
REM Optional offsite mirror: set BACKUP_OFFSITE_DIR in .env (e.g. \\NAS\itat\backups).
cd /d "%~dp0"

node server\scripts\backup-db.js
if errorlevel 1 (
  echo [backup.bat] backup FAILED - see data\backups\LAST_BACKUP.FAILED
  exit /b 1
)

REM --- optional offsite mirror (skipped unless BACKUP_OFFSITE_DIR is set/uncommented in .env) ---
set "OFFSITE="
for /f "usebackq tokens=1,* delims==" %%a in (`findstr /b /c:"BACKUP_OFFSITE_DIR=" .env`) do set "OFFSITE=%%b"
if defined OFFSITE if not "%OFFSITE%"=="" (
  echo [backup.bat] mirroring data\backups -^> %OFFSITE%
  robocopy "data\backups" "%OFFSITE%" /mir /r:2 /w:5 /njh /njs /ndl /nc /ns
  REM robocopy exit codes 0-7 = success, 8+ = failure
  if errorlevel 8 (
    echo [backup.bat] OFFSITE MIRROR FAILED
    exit /b 1
  )
)
exit /b 0
