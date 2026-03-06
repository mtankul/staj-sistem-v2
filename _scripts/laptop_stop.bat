@echo off
title STAJ SISTEM V2 - LAPTOP STOP

echo.
echo ==== PROJE KLASORU ====
cd /d D:\staj-sistem-v2

echo.
echo ==== GIT DURUM ====
git status

echo.
echo ==== GIT ADD ====
git add .

echo.
set /p msg=Commit mesaji yaz: 

git commit -m "%msg%"

echo.
echo ==== GIT PUSH ====
git push

echo.
echo ==== DB BACKUP ====
docker exec -t stajv2_pg pg_dump -U stajv2 -d stajv2 > "D:\YandexDisk\MEHMET\YAZILIM\MUYS\stajv2_dump.tmp.sql"

if errorlevel 1 (
    echo HATA: DB backup basarisiz.
    pause
    exit /b 1
)

for %%A in ("D:\YandexDisk\MEHMET\YAZILIM\MUYS\stajv2_dump.tmp.sql") do set SIZE=%%~zA
if "%SIZE%"=="0" (
    echo HATA: Dump dosyasi 0 KB olustu. Mevcut yedek korunuyor.
    del /f /q "D:\YandexDisk\MEHMET\YAZILIM\MUYS\stajv2_dump.tmp.sql"
    pause
    exit /b 1
)

move /Y "D:\YandexDisk\MEHMET\YAZILIM\MUYS\stajv2_dump.tmp.sql" "D:\YandexDisk\MEHMET\YAZILIM\MUYS\stajv2_dump.sql" >nul

echo.
echo ==== DOCKER STOP ====
docker stop stajv2_pg

echo.
echo OK: Laptop kapanis islemleri tamamlandi.
pause