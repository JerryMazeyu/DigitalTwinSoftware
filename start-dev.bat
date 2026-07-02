@echo off
setlocal

cd /d "%~dp0"

if exist "C:\Program Files\nodejs\node.exe" (
  set "PATH=C:\Program Files\nodejs;%PATH%"
)

echo Starting DigitalTwinSoftware...
echo.
echo API:  http://127.0.0.1:8787
echo UI:   http://127.0.0.1:5173
echo Data: P:\
echo.
echo Press Ctrl+C to stop both services.
echo.

"C:\Program Files\nodejs\npm.cmd" run dev

if errorlevel 1 (
  echo.
  echo Failed to start with C:\Program Files\nodejs\npm.cmd, trying npm from PATH...
  npm run dev
)

endlocal
