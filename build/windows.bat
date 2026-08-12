@echo off
REM Build SYNAPSE.exe on Windows. Double click this file, or run it from the repo root.
cd /d "%~dp0.."
python -m pip install pyinstaller
python -m PyInstaller synapse.spec
echo.
echo Done. Your app is dist\SYNAPSE.exe
pause
