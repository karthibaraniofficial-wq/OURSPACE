@echo off
title Install OURSPACE Desktop Shortcut
echo ===================================================
echo   Installing OURSPACE Desktop Shortcut (v2.3.0)
echo ===================================================
echo.

set "TARGET_EXE=%~dp0OURSPACE-Windows-Portable-v2.3.0.exe"
if not exist "%TARGET_EXE%" set "TARGET_EXE=%~dp0OURSPACE-Windows-Setup-v2.3.0.exe"
set "ICON_FILE=%~dp0..\assets\icons\icon.ico"
set "SHORTCUT_PATH=%USERPROFILE%\Desktop\OURSPACE.lnk"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT_PATH%'); $s.TargetPath = '%TARGET_EXE%'; $s.WorkingDirectory = '%~dp0'; if (Test-Path '%ICON_FILE%') { $s.IconLocation = '%ICON_FILE%' }; $s.Description = 'OURSPACE — Two Hearts. One Private Digital World.'; $s.Save()"

if exist "%SHORTCUT_PATH%" (
    echo [OK] Desktop shortcut created successfully at:
    echo      %SHORTCUT_PATH%
) else (
    echo [ERROR] Failed to create shortcut.
)
echo.
pause
