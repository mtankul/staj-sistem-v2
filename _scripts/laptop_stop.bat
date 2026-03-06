@echo off
title STAJ SISTEM V2 - LAPTOP STOP

set PROJ=D:\staj-sistem-v2
set YANDEX=D:\YandexDisk\MEHMET\YAZILIM\MUYS
<<<<<<< HEAD
set TMP=%YANDEX%\stajv2_dump.tmp.sql
=======
set TMP_LOCAL=D:\stajv2_dump.tmp.sql
>>>>>>> 25f083541245d290b2c03e967dd710f2d9135bb1
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
<<<<<<< HEAD
cmd /c "docker exec -t stajv2_pg pg_dump -U stajv2 -d stajv2 > D:\YandexDisk\MEHMET\YAZILIM\MUYS\stajv2_dump.tmp.sql"
=======
docker exec -t stajv2_pg pg_dump -U stajv2 -d stajv2 > "%TMP_LOCAL%"
>>>>>>> 25f083541245d290b2c03e967dd710f2d9135bb1
if errorlevel 1 (
    echo HATA: DB backup basarisiz.
    pause
    exit /b 1
)

<<<<<<< HEAD
for %%A in ("%TMP%") do set SIZE=%%~zA
if "%SIZE%"=="0" (
    echo HATA: Dump dosyasi 0 KB olustu. Mevcut yedek korunuyor.
    del /f /q "%TMP%"
=======
for %%A in ("%TMP_LOCAL%") do set SIZE=%%~zA
if "%SIZE%"=="0" (
    echo HATA: Dump dosyasi 0 KB olustu. Mevcut yedek korunuyor.
    del /f /q "%TMP_LOCAL%"
>>>>>>> 25f083541245d290b2c03e967dd710f2d9135bb1
    pause
    exit /b 1
)

<<<<<<< HEAD
move /Y "%TMP%" "%FINAL%" >nul
=======
copy /Y "%TMP_LOCAL%" "%FINAL%" >nul
if errorlevel 1 (
    echo HATA: Yandex klasorune kopyalanamadi.
    pause
    exit /b 1
)

del /f /q "%TMP_LOCAL%"
>>>>>>> 25f083541245d290b2c03e967dd710f2d9135bb1

echo.
echo ==== DOCKER STOP ====
docker stop stajv2_pg

echo.
echo OK: LAPTOP_STOP tamamlandi.
pause