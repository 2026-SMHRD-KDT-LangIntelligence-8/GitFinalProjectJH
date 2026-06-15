@echo off
rem ===== 로컬 테스트 DB 생성 + 원격 캠퍼스 DB 복제 =====
rem 원격(campus) DB의 스키마+데이터를 로컬 MariaDB(final_project_test)로 통째 복제한다.
rem 테스트 데이터를 최신 원격 상태로 갱신하고 싶을 때 다시 실행하면 된다.
rem 필요: MariaDB 클라이언트(mysql/mysqldump). 아래 경로/접속정보는 환경에 맞게 수정 가능.
setlocal
set MARIA_BIN=C:\Program Files\MariaDB 10.11\bin

rem --- 원격(campus) ---
set SRC_HOST=project-db-campus.smhrd.com
set SRC_PORT=3308
set SRC_USER=campus_24KDT_LI8_p3_bjh
set SRC_PASS=smhrd1
set SRC_DB=campus_24KDT_LI8_p3_bjh

rem --- 로컬(test) ---
set DST_HOST=127.0.0.1
set DST_PORT=3308
set DST_USER=root
set DST_PASS=1234
set DST_DB=final_project_test

set DUMP=%TEMP%\campus_dump.sql

echo [1/3] 로컬 테스트 DB 생성 (%DST_DB%)
"%MARIA_BIN%\mysql.exe" -h %DST_HOST% -P %DST_PORT% -u %DST_USER% -p%DST_PASS% -e "CREATE DATABASE IF NOT EXISTS %DST_DB% CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;"

echo [2/3] 원격 덤프 (스키마+데이터)
"%MARIA_BIN%\mysqldump.exe" -h %SRC_HOST% -P %SRC_PORT% -u %SRC_USER% -p%SRC_PASS% --single-transaction --no-tablespaces --default-character-set=utf8mb4 %SRC_DB% > "%DUMP%"

echo [3/3] 로컬 적재
"%MARIA_BIN%\mysql.exe" -h %DST_HOST% -P %DST_PORT% -u %DST_USER% -p%DST_PASS% --default-character-set=utf8mb4 %DST_DB% < "%DUMP%"

echo 완료. 로컬 테스트 DB(%DST_DB%) 준비됨.
endlocal
