@echo off
title 8x8 Dashboard
cd /d "%~dp0"

:: Check Node is installed
where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH.
    echo Download it from https://nodejs.org
    pause
    exit /b 1
)

:: Install dependencies if node_modules is missing
if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 ( echo npm install failed. && pause && exit /b 1 )
)

:: Build the frontend if dist is missing or outdated
if not exist "dist\" (
    echo Building frontend...
    call npm run build
    if errorlevel 1 ( echo Build failed. && pause && exit /b 1 )
)

:: Open browser after short delay (server needs a moment to start)
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:3001"

echo.
echo  Starting 8x8 Dashboard server...
echo  Dashboard will open at http://localhost:3001
echo  If Chrome opens for 8x8 login, complete the sign-in and the window will close.
echo  Press Ctrl+C to stop the server.
echo.

set NODE_ENV=production
node server/index.cjs
pause
