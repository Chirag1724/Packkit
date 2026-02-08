@echo off
title PackKit Startup
color 0A

echo ========================================
echo         PackKit Startup Script
echo ========================================
echo.

set IP=localhost
for /f "usebackq tokens=*" %%i in (`powershell -NoProfile -Command "Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike '*Loopback*' -and $_.InterfaceAlias -notlike '*vEthernet*' -and $_.InterfaceAlias -notlike '*Pseudo*' } | Select-Object -ExpandProperty IPAddress | Select-Object -First 1"`) do set IP=%%i
if "%IP%"=="localhost" (
    for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do set IP=%%a
)
set IP=%IP: =%


echo [1/5] Configuring Firewall for LAN access...
netsh advfirewall firewall show rule name="PackKit Backend" >nul 2>&1
if %errorlevel% neq 0 (
    netsh advfirewall firewall add rule name="PackKit Backend" dir=in action=allow protocol=tcp localport=4873 >nul 2>&1
    if %errorlevel% equ 0 (echo    Firewall rule added for port 4873) else (echo    Note: Run as Admin to add firewall rules)
)
netsh advfirewall firewall show rule name="PackKit Frontend" >nul 2>&1
if %errorlevel% neq 0 (
    netsh advfirewall firewall add rule name="PackKit Frontend" dir=in action=allow protocol=tcp localport=5174 >nul 2>&1
    if %errorlevel% equ 0 (echo    Firewall rule added for port 5174) else (echo    Note: Run as Admin to add firewall rules)
)


echo [2/5] Checking Ollama...
curl -s http://localhost:11434/api/version >nul 2>&1
if %errorlevel% neq 0 (
    echo Starting Ollama...
    start "" ollama serve
    timeout /t 3 /nobreak >nul
) else (
    echo Ollama is already running
)


echo [3/5] Starting Backend Server...
cd /d "%~dp0backend"
if not exist node_modules (
    echo Installing backend dependencies...
    call npm install
)
start "PackKit Backend" cmd /k "node server.js"
timeout /t 2 /nobreak >nul


echo [4/5] Starting Frontend...
cd /d "%~dp0frontend"
if not exist node_modules (
    echo Installing frontend dependencies...
    call npm install
)
start "PackKit Frontend" cmd /k "npm run dev"
timeout /t 3 /nobreak >nul


echo [5/5] Opening Dashboards...
timeout /t 2 /nobreak >nul
start "" http://localhost:5174
timeout /t 1 /nobreak >nul
start "" http://localhost:5174/admin

echo.
echo ========================================
echo         PackKit is Running!
echo ========================================
echo.
echo   LOCAL ACCESS:
echo     Chat:  http://localhost:5174
echo     Admin: http://localhost:5174/admin
echo     API:   http://localhost:4873
echo.
echo ========================================
echo.
echo   NETWORK ACCESS (for other PCs):
echo     Option 1 (Best):
echo       Chat:  http://%IP%:5174
echo       Admin: http://%IP%:5174/admin
echo       API:   http://%IP%:4873
echo.
echo     Option 2 (If IP changes):
echo       Chat:  http://%COMPUTERNAME%:5174
echo       Admin: http://%COMPUTERNAME%:5174/admin
echo       API:   http://%COMPUTERNAME%:4873
echo.
echo   CLIENT SETUP (run on other PCs):
echo     npm config set registry http://%IP%:4873 (Recommended)
echo       OR
echo     npm config set registry http://%COMPUTERNAME%:4873
echo.
echo ========================================
echo Press any key to exit this window...
pause >nul
