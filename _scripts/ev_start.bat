@echo off
title EV_START - Pull + DB Restore + Docker Up

set PROJECT_DIR=D:\staj-sistem-v2
set DUMP_PATH=D:\YANDEX_MTANKUL\YandexDisk\MEHMET\YAZILIM\MUYS\stajv2_dump.sql
set CONTAINER=stajv2_pg
set DB_USER=stajv2
set DB_NAME=stajv2

cd /d %PROJECT_DIR%

echo ==== GIT PULL ====
git pull
if errorlevel 1 (
  echo HATA: git pull basarisiz.
  pause
  exit /b 1
)

echo.
echo ==== DOCKER UP ====
docker compose up -d
if errorlevel 1 (
  echo HATA: docker compose up -d basarisiz.
  pause
  exit /b 1
)

echo.
echo ==== DB RESTORE (varsa) ====
if not exist "%DUMP_PATH%" (
  echo UYARI: Dump yok, restore atlandi.
  echo %DUMP_PATH%
  pause
  exit /b 0
)

docker exec -i %CONTAINER% psql -U %DB_USER% -d postgres -c "DROP DATABASE IF EXISTS %DB_NAME%;"
docker exec -i %CONTAINER% psql -U %DB_USER% -d postgres -c "CREATE DATABASE %DB_NAME%;"
cmd /c "type %DUMP_PATH% | docker exec -i %CONTAINER% psql -U %DB_USER% -d %DB_NAME%"

if errorlevel 1 (
  echo HATA: Restore basarisiz.
  pause
  exit /b 1
)

echo OK: EV_START tamam.
pause