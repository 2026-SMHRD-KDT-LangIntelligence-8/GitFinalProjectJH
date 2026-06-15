@echo off
rem ===== 테스트 모드 실행 =====
rem 원격 캠퍼스 DB가 아닌 "로컬 MariaDB 테스트 DB(final_project_test)"에 연결해 실행한다.
rem (기본 실행은 gradlew bootRun = 원격 DB. 이 스크립트는 test 프로파일만 켠다.)
rem 로컬 DB 접속을 바꾸려면 TEST_DB_URL / TEST_DB_USERNAME / TEST_DB_PASSWORD 환경변수를 설정.
rem 카카오 로그인까지 테스트하려면 KAKAO_REST_API_KEY / KAKAO_CLIENT_SECRET 도 set.
cd /d "%~dp0"
set SPRING_PROFILES_ACTIVE=test
call gradlew.bat bootRun
