# 음성 분석 서버 (Speech Analysis FastAPI Server)

노인 인지검사 음성 답변을 분석하는 파이썬 파이프라인을 **FastAPI 서버로 분리**하여,
Spring 백엔드와 **두 서버 병행 구조**로 운영하기 위한 모듈입니다.

---

## 1. 배경 & 목적 (왜 분리했는가)

기존에는 Spring이 문항마다 `ProcessBuilder`로 `python run_question_analysis.py`를 **새 프로세스로 실행**했습니다.
그런데 `speech_analysis_pipeline.py`는 **import 시점에 Whisper STT 모델(~1–2GB)을 로드**합니다.

> 즉 검사 1회(25문항)면 모델을 **25번** 로드 → 운영 불가 수준.

**해결:** 파이프라인을 FastAPI 서버로 분리해 **모델을 기동 시 단 1회만 로드**하고 상주시킵니다.
Spring은 HTTP(JSON)로 호출합니다. 응답 JSON 스키마는 기존과 동일하게 유지하여 Java/DB 변경을 최소화했습니다.

---

## 2. 아키텍처

```
   브라우저 (인지검사 UI)
        │  음성 업로드 (webm)
        ▼
┌─────────────────────────┐        HTTP/JSON         ┌──────────────────────────────┐
│  Spring Boot (8081)      │ ───────────────────────▶ │  FastAPI 음성분석 (8000)        │
│  - CognitiveTestService  │  POST /analyze-question  │  - 모델 1회 로드 (상주)          │
│  - ReportService         │  POST /report-summary    │  - ffmpeg 노이즈제거+webm→wav   │
│  - AnalysisPipelineSvc   │ ◀─────────────────────── │  - Whisper STT → 지표 → LLM채점  │
│    (RestClient)          │      결과 JSON            │  - speech_analysis_pipeline.py  │
└─────────────────────────┘                          └──────────────────────────────┘
        │                                                         │
        ▼ MariaDB(공유)                                            ▼ OpenAI API (적절성 채점, 선택)
   QUESTION_RESULTS / ANALYSIS_RESULTS                        cognitive-voice/ (음성 파일, 공유 디스크)
```

- **오디오 전달 방식**: 같은 PC 전제. Spring이 저장한 음성 **절대경로**를 JSON으로 넘기고 FastAPI가 디스크에서 읽음(파일 재업로드 없음).
- **STT 백엔드**: 현재 로컬 Whisper(`seastar105/whisper-medium-komixv2`). 추후 `gpt-4o-transcribe`(OpenAI) 전환 대비 플래그(`STT_BACKEND`)만 마련됨.

---

## 3. 구성 파일

| 파일 | 역할 |
|---|---|
| `app.py` | **FastAPI 서버**. lifespan에서 모델 1회 로드, 엔드포인트 3개 |
| `speech_analysis_pipeline.py` | 핵심 파이프라인(STT, 노이즈제거, 지표, LLM 채점). import=모델 로드 |
| `run_server.bat` | FastAPI 실행기 (env + uvicorn) |
| `run_question_analysis.py` / `run_report_summary.py` | 구(舊) CLI 진입점. 계약 참조·애드혹용으로 보존(주 경로 아님) |
| `requirements.txt` | 파이썬 의존성 |
| `.env` | `OPENAI_API_KEY` 등 비밀값 (git 미추적) |
| `.env.example` | `.env` 템플릿 |
| `../start_all.bat` | (프로젝트 루트) FastAPI + Spring 동시 기동 |

---

## 4. 의존성

### 4.1 시스템 요구사항
- **Python 3.13+**
- **Java 21**, Spring Boot 4.0.6 (Spring 측)
- **ffmpeg** — 노이즈 제거 + webm→wav 변환에 사용
  - 시스템 설치(`winget install Gyan.FFmpeg`) 또는 **미설치 시 `imageio-ffmpeg` 번들 자동 사용**(pip로 따라옴)
- **MariaDB** 접속 (공유 캠퍼스 DB)

### 4.2 파이썬 패키지 (`requirements.txt`)
```
torch transformers accelerate      # Whisper STT 모델
librosa soundfile numpy            # 오디오 로딩/신호처리
openai                             # LLM 적절성 채점
imageio-ffmpeg                     # ffmpeg 번들 (시스템 ffmpeg 없을 때 fallback)
python-dotenv                      # .env 로드
fastapi uvicorn[standard]          # HTTP 서버
```

---

## 5. 설치

```powershell
cd "speech_analysis"

# 1) 파이썬 의존성 설치 (torch 등 수백 MB~GB, 시간 소요)
python -m pip install -r requirements.txt

# 2) OpenAI 키 설정 (LLM 적절성 채점에 필요. 안 쓰면 생략 가능)
copy .env.example .env
#   .env 를 열어 OPENAI_API_KEY=sk-... 실제 키 입력
```

> `.env`는 `.gitignore`로 보호되어 깃에 올라가지 않습니다.

---

## 6. 실행

### 6.1 FastAPI 음성분석 서버 (먼저 기동)
```powershell
# 방법 A: 배치 스크립트
speech_analysis\run_server.bat

# 방법 B: 수동
cd speech_analysis
$env:KMP_DUPLICATE_LIB_OK="TRUE"   # OpenMP 중복 로드 방지 (torch+librosa)
$env:PYTHONIOENCODING="utf-8"       # 한글 콘솔 출력
python -m uvicorn app:app --host 0.0.0.0 --port 8000 --workers 1
```
- 기동 시 **모델 로드 10~30초** 소요. `Application startup complete` 로그가 뜨면 준비 완료.
- 준비 확인: `curl http://localhost:8000/health` → `{"status":"ok","model_loaded":true,...}`

### 6.2 Spring 서버 (이어서 기동)
```powershell
# DB / 카카오 / (선택) 음성분석 URL 환경변수
$env:DB_URL="jdbc:mariadb://project-db-campus.smhrd.com:3308/campus_24KDT_LI8_p3_bjh"
$env:DB_USERNAME="campus_24KDT_LI8_p3_bjh"
$env:DB_PASSWORD="smhrd1"
$env:KAKAO_REST_API_KEY="<카카오 REST API 키>"
$env:KAKAO_CLIENT_SECRET="<카카오 Client Secret>"
# $env:SPEECH_ANALYSIS_URL="http://localhost:8000"   # 기본값이라 보통 생략
# $env:SPEECH_ANALYSIS_USE_LLM="true"                 # LLM 적절성 채점 켤 때

.\gradlew.bat bootRun
```
- 접속: http://localhost:8081

### 6.3 한 번에 (개발 편의)
```powershell
# 루트의 start_all.bat — FastAPI를 새 창으로 띄우고 이어서 Spring 실행
#  (DB_*/KAKAO_* 환경변수는 미리 set 하거나 시스템 환경변수로 등록)
.\start_all.bat
```

### 6.4 기동 순서
1. **FastAPI 먼저** → `/health`가 `model_loaded:true` 확인
2. **Spring 기동**
- Spring을 먼저 띄워도 됨: FastAPI 미준비 시 첫 분석 요청이 503/타임아웃으로 **명확히 실패**(데이터 오염 없음).

---

## 7. API 계약

### `GET /health`
준비 전 503, 완료 시:
```json
{"status":"ok","model_loaded":true,"model_name":"seastar105/whisper-medium-komixv2"}
```

### `POST /analyze-question`
요청:
```json
{
  "audio_path": "C:\\...\\cognitive-voice\\2026-06-11\\홍길동_42\\그림_설명하기_q310_100729.webm",
  "question_type_name": "그림 설명하기",
  "question_text": "그림을 보고 어떤 장면인지 설명해 주세요.",
  "image_description": "시장에서 상인이 과일을 저울에 달고...",
  "use_llm_scoring": false
}
```
응답(키 12개, Java `QuestionAnalysisResult`와 매핑):
```json
{
  "audio_file_path": "...", "stt_text": "...", "preprocessed_text": "...",
  "response_time": 0.95, "repetition_ratio": 0.0, "avg_sentence_length": 34.0,
  "appropriateness_score": 100, "repetition_score": 100, "sentence_length_score": 100,
  "question_type_name": "그림 설명하기", "response_time_score": 100, "final_score": 92.0
}
```
- `appropriateness_score`는 `use_llm_scoring:false`면 `null`.
- `question_type_name` 유효값: `오늘 날짜 말하기`, `그림 설명하기`, `상황 질문 답하기`, `규칙 기반 언어추론`, `추억 말하기`.

### `POST /report-summary`
요청 body = 분석 행 리스트:
```json
[{"question_type_name":"그림 설명하기","response_time":3.2,"repetition_ratio":5.0,"avg_sentence_length":28.0,"appropriateness_score":80}, ...]
```
응답 = 종합 요약(`question_count`, `avg_final_score`, `question_type_summaries`, `rows` 등).

---

## 8. Spring 연동 설정 (`application.properties`)
```
app.speech-analysis.base-url=${SPEECH_ANALYSIS_URL:http://localhost:8000}
app.speech-analysis.connect-timeout-ms=5000
app.speech-analysis.read-timeout-ms=60000     # STT 추론 10~30초 대비
app.speech-analysis.use-llm-scoring=${SPEECH_ANALYSIS_USE_LLM:false}
```
- 호출 주체: `src/main/java/com/example/final_project/analysis/AnalysisPipelineService.java` (Spring `RestClient`).
- DTO: `QuestionAnalysisResult`(@JsonProperty snake_case), `ReportSummaryResult`.

---

## 9. 검증

```powershell
# 0) 두 서버(또는 FastAPI) 기동 상태에서

# 1) 헬스
curl http://localhost:8000/health

# 2) 계약 동등성: HTTP 응답 == run_question_analysis.py 출력
cd speech_analysis; python _verify_contract.py     # "계약 동등성: 일치 ✓"

# 3) 배치 테스트(여러 음성 일괄 분석) — 기존 스크립트
python _batch_test_tester.py
```
- **End-to-End**: 브라우저에서 인지검사 진행 → 음성 업로드 → `QUESTION_RESULTS`(STT)·`ANALYSIS_RESULTS`(지표) 적재 → 리포트 조회.

---

## 10. 트러블슈팅

| 증상 | 원인 / 해결 |
|---|---|
| `OMP: Error #15 ... libiomp5md.dll already initialized` | torch+librosa의 OpenMP 중복. **`KMP_DUPLICATE_LIB_OK=TRUE`** 설정(run_server.bat에 포함됨) |
| 한글이 콘솔에 깨짐 | **`PYTHONIOENCODING=utf-8`** (실제 처리/응답 값은 정상, 표시 문제) |
| `ffmpeg을 찾을 수 없어...` 로그 | 노이즈제거 건너뜀(원본 사용). `imageio-ffmpeg` 설치돼 있으면 자동 사용. webm 입력은 ffmpeg 필요 |
| `/health` 503 `loading` | 모델 로드 중(10~30초). 잠시 후 재확인 |
| Spring "분석 서버 호출 실패" | FastAPI(8000) 미기동. 먼저 띄울 것 |
| 포트 충돌 | FastAPI 8000 / Spring 8081. 변경 시 `--port` 와 `SPEECH_ANALYSIS_URL` 함께 조정 |
| 첫 실행이 느림 | Whisper 모델 최초 다운로드(HuggingFace). 이후 캐시 사용 |

---

## 11. STT 백엔드 전환 (향후)
`speech_analysis_pipeline.py`의 `STT_BACKEND`(기본 `"local"`) 분기 지점이 마련돼 있습니다.
`gpt-4o-transcribe`(OpenAI API)로 전환 시 한국어 정확도 향상·torch 제거 가능하나,
**음성(민감 개인정보) 외부 전송**에 대한 동의·데이터 정책 정비가 선행돼야 합니다.

---

## 12. 보안 / 주의
- ⚠️ `.env`의 `OPENAI_API_KEY`가 과거 노출된 적 있으면 **재발급** 권장.
- 음성 파일(`cognitive-voice/`)은 노인 인지검사 데이터(민감). 보관·전송 정책 확인.
- `.env`는 절대 커밋하지 말 것(`.gitignore` 적용됨). `.env.example`에 실제 키 금지.
