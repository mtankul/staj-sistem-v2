@echo off
title STAJ SISTEM V2 - EV START

echo.
echo ==== PROJE KLASORU ====
cd /d D:\staj-sistem-v2

echo.
echo ==== GIT PULL ====
git pull
if errorlevel 1 (
    echo HATA: git pull basarisiz.
    echo Once git durumunu kontrol et:
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
if not exist "D:\staj-sistem-v2\server\.env" (
    echo .env bulunamadi. Olusturuluyor...
    (
        echo PORT=3000
        echo DATABASE_URL="postgresql://stajv2:stajv2pass@localhost:5433/stajv2?schema=public"
        echo.
        echo JWT_ACCESS_SECRET="change_me_access"
        echo JWT_REFRESH_SECRET="change_me_refresh"
        echo CORS_ORIGIN="http://localhost:5173"
    ) > "D:\staj-sistem-v2\server\.env"
    echo .env olusturuldu.
)

echo.
echo ==== DB RESTORE (YANDEX) ====
if exist "D:\YANDEX_MTANKUL\YandexDisk\MEHMET\YAZILIM\MUYS\stajv2_dump.sql" (
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

    cmd /c "type D:\YANDEX_MTANKUL\YandexDisk\MEHMET\YAZILIM\MUYS\stajv2_dump.sql | docker exec -i stajv2_pg psql -U stajv2 -d stajv2"
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
cd /d D:\staj-sistem-v2\server
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
echo Prisma generate basarili.

echo.
echo ==== CLIENT NODE_MODULES KONTROL ====
cd /d D:\staj-sistem-v2\client
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
start "STAJ SERVER" powershell -NoExit -Command "cd 'D:\staj-sistem-v2\server'; npm run dev"

echo.
echo ==== CLIENT BASLAT ====
start "STAJ CLIENT" powershell -NoExit -Command "cd 'D:\staj-sistem-v2\client'; npm run dev"

echo.
echo OK: EV_START tamam.
pause