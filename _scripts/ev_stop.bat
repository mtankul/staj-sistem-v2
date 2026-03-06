@echo off
title STAJ SISTEM V2 - EV STOP

set PROJ=D:\staj-sistem-v2
set YANDEX=D:\YANDEX_MTANKUL\YandexDisk\MEHMET\YAZILIM\MUYS
set TMP=%YANDEX%\stajv2_dump.tmp.sql
set FINAL=%YANDEX%\stajv2_dump.sql

echo.
echo ==== PROJE KLASORU ====
cd /d %PROJ%

echo.
echo ==== GIT DURUM ====
git status

echo.
echo ==== GIT ADD ====
git add .

echo.
set /p msg=Commit mesaji yaz: 

echo.
echo ==== GIT COMMIT ====
git commit -m "%msg%"

echo.
echo ==== GIT PUSH ====
git push
if errorlevel 1 (
    echo HATA: Git push basarisiz.
    pause
    exit /b 1
)

echo.
echo ==== DB BACKUP ====
cmd /c "docker exec -t stajv2_pg pg_dump -U stajv2 -d stajv2 > D:\YANDEX_MTANKUL\YandexDisk\MEHMET\YAZILIM\MUYS\stajv2_dump.tmp.sql"
if errorlevel 1 (
    echo HATA: DB backup basarisiz.
    pause
    exit /b 1
)

for %%A in ("%TMP%") do set SIZE=%%~zA
if "%SIZE%"=="0" (
    echo HATA: Dump dosyasi 0 KB olustu. Mevcut yedek korunuyor.
    del /f /q "%TMP%"
    pause
    exit /b 1
)

move /Y "%TMP%" "%FINAL%" >nul

echo.
echo ==== DOCKER STOP ====
docker stop stajv2_pg

echo.
echo OK: EV_STOP tamamlandi.
pause