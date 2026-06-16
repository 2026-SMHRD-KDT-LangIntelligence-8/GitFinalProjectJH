# MOBA Python 채점 서버 재세팅

이 폴더는 `speech_analysis.zip` 과 `speech_analysis_pipeline.zip` 의 원본 파이프라인을 기준으로, MOBA에서 호출할 수 있는 FastAPI 채점 서버 형태로 다시 맞춘 구성이다.

## 포함된 핵심 파일

- `speech_analysis_pipeline.py`: 원본 채점 로직
- `app.py`: MOBA/외부 서버가 호출할 FastAPI 엔드포인트
- `requirements.txt`: 원본 ZIP 기준 의존성
- `requirements-server.txt`: 서버 실행에 필요한 의존성
- `run_server.bat`: 윈도우에서 서버 실행

## 엔드포인트

- `GET /health`
- `POST /analyze-question`
- `POST /report-summary`

## 권장 세팅 순서

1. 가상환경 준비

```powershell
cd "C:\Users\smhrd2\Desktop\실전 프로젝트\실전 프로젝트(프로그램파일)\final_project"
py -m venv .venv
.\.venv\Scripts\Activate.ps1
```

2. 의존성 설치

```powershell
cd ".\speech_analysis"
pip install -r requirements-server.txt
```

3. LLM 채점 사용 여부 결정

- OpenAI 키가 있으면:

```powershell
$env:OPENAI_API_KEY="your-key"
```

- 키가 없으면 MOBA 또는 Java 쪽에서 `use_llm_scoring=false` 로 호출
- Spring 연동 시에는 아래처럼 끄는 것이 안전함

```powershell
$env:SPEECH_ANALYSIS_USE_LLM="false"
```

4. 서버 실행

```powershell
.\run_server.bat
```

5. 상태 확인

- 브라우저 또는 호출 도구로 `http://localhost:8000/health`

## MOBA 기준으로 연결할 때

- MOBA 채점 서버 실행 명령은 `speech_analysis\run_server.bat`
- 채점 기준 원본은 `speech_analysis_pipeline.py`
- 문항별 채점은 `/analyze-question`
- 리포트 종합 점수 계산은 `/report-summary`

## 참고

- Whisper 모델은 첫 실제 분석 요청 때 로드되도록 바꿔 두었다.
- 따라서 `health` 확인은 빨리 되지만, 첫 분석 요청은 모델 로딩 때문에 시간이 더 걸릴 수 있다.
