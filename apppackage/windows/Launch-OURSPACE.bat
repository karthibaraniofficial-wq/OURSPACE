@echo off
title OURSPACE Desktop Launcher
echo ===================================================
echo   OURSPACE — Private Couple Sanctuary v2.3.0
echo   Backend: Google Firebase ^| Media: LiveKit SFU
echo ===================================================
echo.
echo Launching native desktop application...
if exist "%~dp0OURSPACE-Windows-Portable-v2.3.0.exe" (
    start "" "%~dp0OURSPACE-Windows-Portable-v2.3.0.exe"
) else (
    start "" "%~dp0OURSPACE-Windows-Setup-v2.3.0.exe"
)
exit /b 0
