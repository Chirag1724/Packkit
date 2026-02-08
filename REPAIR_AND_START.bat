@echo off
title PackKit Repair & Start
color 0E

echo [1/3] Detecting LAN IP...
:: Look for common LAN patterns, fallback to first available
set LAN_IP=
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4" ^| findstr "192.168."') do set LAN_IP=%%a
if "%LAN_IP%"=="" (
    for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4" ^| findstr "10."') do set LAN_IP=%%a
)
if "%LAN_IP%"=="" (
    for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do set LAN_IP=%%a
)

set LAN_IP=%LAN_IP: =%
echo Detected LAN IP: %LAN_IP%

echo.
echo [2/3] Updating NPM Registry Config...
echo Previous:
call npm config get registry
call npm config set registry http://%LAN_IP%:4873
echo Current:
call npm config get registry

echo.
echo [3/3] Starting Services...
cd /d "%~dp0"
start "PackKit Services" cmd /c ".\start.bat"

echo.
echo ======================================================
echo SUCCESS: Registry is now http://%LAN_IP%:4873
echo.
echo TO CONNECT OTHER PCs:
echo 1. Ensure they are on the same Wi-Fi/LAN.
echo 2. Run this command on THEIR PC:
echo    npm config set registry http://%LAN_IP%:4873
echo ======================================================
timeout /t 10
exit
