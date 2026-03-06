@echo off
title STAJ SISTEM V2 - LAPTOP START

set PROJ=D:\staj-sistem-v2
set YANDEX=D:\YandexDisk\MEHMET\YAZILIM\MUYS
set DUMP=%YANDEX%\stajv2_dump.sql

echo.
echo ==== PROJE KLASORU ====
cd /d %PROJ%

echo.
echo ==== GIT PULL ====
git pull
if errorlevel 1 (
    echo HATA: git pull basarisiz.
    echo Once su komutu kontrol et:
    echo git status
    pause
    exit /b 1
)

echo.
echo ==== DOCKER UP ====
docker compose up -d
if errorlevel 1 (
    echo HATA: Docker/Postgres baslatilamadi.
    pause
    exit /b 1
)

echo.
echo ==== SERVER ENV KONTROL ====
if not exist "%PROJ%\server\.env" (
    echo .env bulunamadi. Olusturuluyor...
    (
        echo PORT=3000
        echo DATABASE_URL="postgresql://stajv2:stajv2pass@localhost:5433/stajv2?schema=public"
        echo.
        echo JWT_ACCESS_SECRET="change_me_access"
        echo JWT_REFRESH_SECRET="change_me_refresh"
        echo CORS_ORIGIN="http://localhost:5173"
    ) > "%PROJ%\server\.env"
    echo .env olusturuldu.
)

echo.
echo ==== DB RESTORE (YANDEX) ====
if exist "%DUMP%" (
    echo Yandex dump bulundu. Restore basliyor...

    docker exec -i stajv2_pg psql -U stajv2 -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='stajv2' AND pid <> pg_backend_pid();"
    if errorlevel 1 (
        echo HATA: Aktif baglantilar kapatilamadi.
        pause
        exit /b 1
    )

    docker exec -i stajv2_pg psql -U stajv2 -d postgres -c "DROP DATABASE IF EXISTS stajv2 WITH (FORCE);"
    if errorlevel 1 (
        echo HATA: Veritabani silinemedi.
        pause
        exit /b 1
    )

    docker exec -i stajv2_pg psql -U stajv2 -d postgres -c "CREATE DATABASE stajv2;"
    if errorlevel 1 (
        echo HATA: Veritabani olusturulamadi.
        pause
        exit /b 1
    )

    cmd /c "type %DUMP% | docker exec -i stajv2_pg psql -U stajv2 -d stajv2"
    if errorlevel 1 (
        echo HATA: DB restore basarisiz.
        pause
        exit /b 1
    )
) else (
    echo Yandex dump bulunamadi. Restore atlandi.
)

echo.
echo ==== SERVER NODE_MODULES KONTROL ====
cd /d %PROJ%\server
if not exist node_modules (
    echo node_modules bulunamadi. npm install yapiliyor...
    call npm install
    if errorlevel 1 (
        echo HATA: Server npm install basarisiz.
        pause
        exit /b 1
    )
)

echo.
echo ==== PRISMA GENERATE ====
call npx prisma generate
if errorlevel 1 (
    echo HATA: Prisma generate basarisiz.
    pause
    exit /b 1
)

echo.
echo ==== CLIENT NODE_MODULES KONTROL ====
cd /d %PROJ%\client
if not exist node_modules (
    echo node_modules bulunamadi. npm install yapiliyor...
    call npm install
    if errorlevel 1 (
        echo HATA: Client npm install basarisiz.
        pause
        exit /b 1
    )
)

echo.
echo ==== SERVER BASLAT ====
start "STAJ SERVER" powershell -NoExit -Command "cd '%PROJ%\server'; npm run dev"

echo.
echo ==== CLIENT BASLAT ====
start "STAJ CLIENT" powershell -NoExit -Command "cd '%PROJ%\client'; npm run dev"

echo.
echo OK: LAPTOP_START tamam.
pause