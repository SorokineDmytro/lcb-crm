@echo off
set PORT=3000

:: Check if something is listening on port 3000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%PORT% ^| findstr LISTENING') do (
    echo Port %PORT% is already in use. Assuming the server is already running.
    start "" http://localhost:%PORT%
    exit /b
)

:: If not running, navigate to your app folder
cd /d "C:\Path\To\Your\App"

:: Open browser
start "" http://localhost:%PORT%

:: Start the Node app
start "" cmd /k node app.js