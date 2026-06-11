# -*- coding: utf-8 -*-
"""음성 분석 FastAPI 서버.

Spring 백엔드가 문항마다 파이썬 프로세스를 새로 띄우면 Whisper 모델을 매번
로드(수 GB, 10~30초)하는 문제가 있었다. 이 서버는 기동 시 모델을 한 번만
로드해 상주시키고, Spring은 HTTP(JSON)로 호출한다.

응답 JSON 스키마는 run_question_analysis.py / run_report_summary.py 와 동일하게
유지해 Java 측 변경을 최소화한다.

실행: run_server.bat (uvicorn app:app --port 8000 --workers 1)
"""

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel

# 모델 로드 상태와 파이프라인 모듈 핸들을 담는다.
STATE = {"ready": False, "error": None, "pipe": None, "model_name": None}

# Whisper 추론은 스레드 안전하지 않으므로 호출을 직렬화한다.
INFER_LOCK = asyncio.Lock()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 모듈 import 시점에 Whisper 모델이 1회 로드된다. 기동이 오래 걸리므로
    # 별도 스레드에서 수행해 이벤트 루프를 막지 않는다.
    def _load():
        import speech_analysis_pipeline as pipe
        return pipe

    try:
        pipe = await run_in_threadpool(_load)
        STATE["pipe"] = pipe
        STATE["model_name"] = getattr(pipe, "MODEL_NAME", None)
        STATE["ready"] = True
    except Exception as error:
        # 로드 실패해도 프로세스를 죽이지 않는다. /health 가 미준비를 알린다.
        STATE["error"] = str(error)
    yield


app = FastAPI(title="Speech Analysis Server", lifespan=lifespan)


class AnalyzeRequest(BaseModel):
    audio_path: str
    question_type_name: str
    question_text: str
    image_description: str | None = None
    use_llm_scoring: bool = False


@app.get("/health")
async def health():
    if STATE["error"]:
        raise HTTPException(status_code=503, detail={"status": "error", "model_loaded": False, "detail": STATE["error"]})
    if not STATE["ready"]:
        raise HTTPException(status_code=503, detail={"status": "loading", "model_loaded": False})
    return {"status": "ok", "model_loaded": True, "model_name": STATE["model_name"]}


@app.post("/analyze-question")
async def analyze_question(req: AnalyzeRequest):
    if not STATE["ready"]:
        raise HTTPException(status_code=503, detail="음성 분석 모델이 아직 준비되지 않았습니다.")
    pipe = STATE["pipe"]

    # run_question_analysis.py 의 main() 을 1:1 로 옮긴 것. 채점 로직은 재사용한다.
    def _work():
        result = pipe.analyze_question_answer(
            audio_path=req.audio_path,
            question_type_name=req.question_type_name,
            question_text=req.question_text,
            image_description=req.image_description or None,
            use_llm_scoring=req.use_llm_scoring,
        )

        scored = pipe.calculate_question_final_score({
            "question_type_name": req.question_type_name,
            "response_time": result.get("response_time"),
            "repetition_ratio": result.get("repetition_ratio"),
            "avg_sentence_length": result.get("avg_sentence_length"),
            "appropriateness_score": result.get("appropriateness_score"),
        })

        return {
            **result,
            "question_type_name": req.question_type_name,
            "response_time_score": scored.get("response_time_score"),
            "repetition_score": scored.get("repetition_score"),
            # 파이프라인의 answer_length_score 를 Java 계약의 sentence_length_score 로 매핑한다.
            "sentence_length_score": scored.get("answer_length_score"),
            "final_score": scored.get("final_score"),
        }

    try:
        # 추론은 직렬화하고, 블로킹 작업은 스레드풀로 분리한다.
        async with INFER_LOCK:
            return await run_in_threadpool(_work)
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"문항 분석에 실패했습니다: {error}")


@app.post("/report-summary")
async def report_summary(rows: list[dict]):
    # 리포트 요약은 순수 파이썬 계산이라 모델/락이 필요 없다.
    if STATE["pipe"] is None:
        raise HTTPException(status_code=503, detail="음성 분석 모듈이 아직 준비되지 않았습니다.")
    try:
        return STATE["pipe"].calculate_report_summary(rows or [])
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"리포트 요약 계산에 실패했습니다: {error}")
