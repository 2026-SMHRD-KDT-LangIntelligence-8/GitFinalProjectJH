from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from speech_analysis_pipeline import analyze_question_answer, calculate_report_summary


app = FastAPI()


class AnalyzeQuestionRequest(BaseModel):
    audio_path: str
    question_type_name: str
    question_text: str
    image_description: str | None = None
    use_llm_scoring: bool = True


class ReportSummaryRow(BaseModel):
    question_type_name: str
    response_time: float | None = None
    repetition_ratio: float | None = None
    avg_sentence_length: float | None = None
    appropriateness_score: int | None = None


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "report_summary_available": True,
        "question_analysis_available": True,
    }


@app.post("/analyze-question")
def analyze_question(request: AnalyzeQuestionRequest) -> dict[str, Any]:
    try:
        return analyze_question_answer(
            audio_path=request.audio_path,
            question_type_name=request.question_type_name,
            question_text=request.question_text,
            image_description=request.image_description,
            use_llm_scoring=request.use_llm_scoring,
        )
    except Exception as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


@app.post("/report-summary")
def report_summary(rows: list[ReportSummaryRow]) -> dict[str, Any]:
    try:
        return calculate_report_summary([row.model_dump() for row in rows])
    except Exception as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
