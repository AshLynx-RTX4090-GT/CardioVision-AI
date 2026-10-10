@echo off
cd /d "%~dp0\.."
echo Starting CardioVision AI...
if not exist node_modules (
    echo Installing dependencies...
    call npm install
)
echo Server running at http://localhost:3000
npm start
