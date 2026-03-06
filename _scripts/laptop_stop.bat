@echo off
title LAPTOP_STOP - DB Backup to Yandex

set PROJECT_DIR=D:\staj-sistem-v2
set DUMP_DIR=D:\YandexDisk\MEHMET\YAZILIM\MUYS
set DUMP_PATH=%DUMP_DIR%\stajv2_dump.sql
set TMP_PATH=%DUMP_DIR%\stajv2_dump.tmp
set CONTAINER=stajv2_pg
set DB_USER=stajv2
set DB_NAME=stajv2

cd /d %PROJECT_DIR%

echo ==== DB BACKUP ====
docker ps --format "{{.Names}}" | findstr /i "%CONTAINER%" >nul
if errorlevel 1 (
  echo HATA: %CONTAINER% calismiyor. (docker compose up -d)
  pause
  exit /b 1
)

docker exec -t %CONTAINER% pg_dump -U %DB_USER% -d %DB_NAME% > "%TMP_PATH%"
if errorlevel 1 (
  echo HATA: Dump alinamadi.
  pause
  exit /b 1
)

move /Y "%TMP_PATH%" "%DUMP_PATH%" >nul
echo OK: Dump yazildi: %DUMP_PATH%
echo Not: Kod degisikligi yaptiysaniz git commit/push yapmayi unutmayin.
pause