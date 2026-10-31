@echo off
setlocal
echo ===================================================
echo   Installing OURSPACE Desktop Shortcut
echo ===================================================
echo.

set TARGET=%~dp0OURSPACE-Windows-v2.0.0.exe
set SCRIPT="%TEMP%\CreateOurSpaceShortcut.vbs"

echo Set oWS = WScript.CreateObject("WScript.Shell") > %SCRIPT%
echo sLinkFile = oWS.SpecialFolders("Desktop") ^& "\OURSPACE.lnk" >> %SCRIPT%
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> %SCRIPT%
echo oLink.TargetPath = "%TARGET%" >> %SCRIPT%
echo oLink.WorkingDirectory = "%~dp0" >> %SCRIPT%
echo oLink.Description = "OURSPACE — Private Couple Sanctuary" >> %SCRIPT%
echo oLink.Save >> %SCRIPT%

cscript /nologo %SCRIPT%
del %SCRIPT%

echo [SUCCESS] Desktop shortcut created successfully!
echo You can now launch OURSPACE directly from your desktop.
echo.
pause
exit /b 0
