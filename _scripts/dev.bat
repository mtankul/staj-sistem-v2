@echo off
cd /d D:\staj-sistem-v2

start "SERVER" cmd /k "cd /d D:\staj-sistem-v2\server && npm run dev"
start "CLIENT" cmd /k "cd /d D:\staj-sistem-v2\client && npm run dev"