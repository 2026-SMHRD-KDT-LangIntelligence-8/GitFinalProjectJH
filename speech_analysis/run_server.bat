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

echo Starting speech-analysis FastAPI server on http://127.0.0.1:8000
"%PYTHON%" -m uvicorn app:app --host 0.0.0.0 --port 8000

endlocal
