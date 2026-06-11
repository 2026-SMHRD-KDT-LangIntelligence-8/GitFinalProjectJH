package com.example.final_project.analysis.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

// 문항 1개 음성에 대한 STT 결과와 채점 결과를 자바에서 묶어 다루기 위한 DTO다.
// FastAPI 음성 분석 서버가 내려주는 snake_case JSON 을 그대로 역직렬화한다.
public record QuestionAnalysisResult(
        @JsonProperty("stt_text")
        String sttText,
        @JsonProperty("preprocessed_text")
        String preprocessedText,
        @JsonProperty("response_time")
        Double responseTime,
        @JsonProperty("repetition_ratio")
        Double repetitionRatio,
        @JsonProperty("avg_sentence_length")
        Double avgSentenceLength,
        @JsonProperty("appropriateness_score")
        Integer appropriatenessScore,
        @JsonProperty("repetition_score")
        Integer repetitionScore,
        @JsonProperty("sentence_length_score")
        Integer sentenceLengthScore,
        @JsonProperty("final_score")
        Double finalScore
) {
}
