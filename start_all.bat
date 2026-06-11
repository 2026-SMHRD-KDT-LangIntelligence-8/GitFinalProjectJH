@echo off
rem 개발 편의용: FastAPI 음성분석 서버를 새 창으로 띄우고, 이어서 Spring 서버를 실행한다.
rem FastAPI는 모델 로드에 10~30초 걸리므로 먼저 띄운다.
rem (DB_*/KAKAO_* 환경변수는 이 창에서 미리 set 하거나 시스템 환경변수로 등록해 둔다.)
cd /d "%~dp0"

start "speech-analysis-fastapi" cmd /c "speech_analysis\run_server.bat"

echo FastAPI 서버를 새 창에서 기동했습니다. 모델 로드(약 10~30초) 후 http://localhost:8000/health 확인.
echo Spring 서버를 시작합니다...
call gradlew.bat bootRun
