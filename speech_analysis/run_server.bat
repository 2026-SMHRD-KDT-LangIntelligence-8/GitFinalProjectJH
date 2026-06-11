@echo off
rem 음성 분석 FastAPI 서버 실행 (포트 8000, 워커 1개)
rem - KMP_DUPLICATE_LIB_OK: torch(MKL)+librosa(numba)의 OpenMP 중복 로드 방지
rem - PYTHONIOENCODING: 한글 콘솔 출력 보정
cd /d "%~dp0"
set KMP_DUPLICATE_LIB_OK=TRUE
set PYTHONIOENCODING=utf-8
python -m uvicorn app:app --host 0.0.0.0 --port 8000 --workers 1
