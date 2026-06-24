@echo off
setlocal
cd /d C:\CORTEX\apps\desktop

set CORTEX_API_BASE_URL=http://127.0.0.1:8000

start "" cmd /k "npm run start"
