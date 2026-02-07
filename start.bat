@echo off
title PackKit Startup
color 0A

echo ========================================
echo         PackKit Startup Script
echo ========================================
echo.

:: Get IP Address
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    set IP=%%a
)
set IP=%IP: =%

:: Check if Ollama is running
echo [1/4] Checking Ollama...
curl -s http://localhost:11434/api/version >nul 2>&1
if %errorlevel% neq 0 (
    echo Starting Ollama...
    start "" ollama serve
    timeout /t 3 /nobreak >nul
) else (
    echo Ollama is already running
)

:: Start Backend
echo [2/4] Starting Backend Server...
cd /d "%~dp0backend"
if not exist node_modules (
    echo Installing backend dependencies...
    call npm install
)
start "PackKit Backend" cmd /k "node server.js"
timeout /t 2 /nobreak >nul

:: Start Frontend
echo [3/4] Starting Frontend...
cd /d "%~dp0frontend"
if not exist node_modules (
    echo Installing frontend dependencies...
    call npm install
)
start "PackKit Frontend" cmd /k "npm run dev"
timeout /t 3 /nobreak >nul

:: Open browsers
echo [4/4] Opening Dashboards...
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
echo   NETWORK ACCESS (for other PCs):
echo     Chat:  http://%IP%:5174
echo     Admin: http://%IP%:5174/admin
echo     API:   http://%IP%:4873
echo.
echo   CLIENT SETUP (run on other PCs):
echo     npm config set registry http://%IP%:4873
echo.
echo ========================================
echo Press any key to exit this window...
pause >nul
