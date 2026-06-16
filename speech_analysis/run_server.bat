@echo off
setlocal

cd /d "%~dp0"

if exist "..\.venv\Scripts\python.exe" (
    set "PYTHON=..\.venv\Scripts\python.exe"
) else (
    set "PYTHON=py"
)

if not exist "requirements-server.txt" (
    echo requirements-server.txt file not found.
    exit /b 1
)

"%PYTHON%" -V >nul 2>&1
if errorlevel 1 (
    echo Python runtime is not available.
    echo Recreate the virtual environment or install Python, then try again.
    echo Example:
    echo   py -m venv .venv
    echo   .\.venv\Scripts\Activate.ps1
    echo   pip install -r speech_analysis\requirements-server.txt
    exit /b 1
)

rem .env 파일에서 환경변수 로드 (OPENAI_API_KEY 등). 주석(#)과 빈 줄은 건너뛴다.
if exist ".env" (
    for /f "usebackq eol=# tokens=1,* delims==" %%a in (".env") do (
        if not "%%a"=="" set "%%a=%%b"
    )
) else (
    echo [warn] .env not found. OPENAI_API_KEY must be set in the environment.
)

rem 로컬 Whisper(torch+librosa) OpenMP 중복 로드 방지 + 한글 콘솔 출력
set "KMP_DUPLICATE_LIB_OK=TRUE"
set "PYTHONIOENCODING=utf-8"

if not defined OPENAI_API_KEY echo [warn] OPENAI_API_KEY is not set. The server may fail to start.

echo Starting speech-analysis FastAPI server on http://127.0.0.1:8000
"%PYTHON%" -m uvicorn app:app --host 0.0.0.0 --port 8000

endlocal
