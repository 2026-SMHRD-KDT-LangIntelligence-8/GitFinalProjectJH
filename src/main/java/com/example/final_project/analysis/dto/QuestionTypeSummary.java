package com.example.final_project.analysis.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

// 파이썬 리포트 요약 결과 중 문항 유형별 집계값을 매핑하기 위한 DTO다.
public record QuestionTypeSummary(
        @JsonProperty("question_count")
        Integer questionCount,
        @JsonProperty("avg_response_time")
        Double avgResponseTime,
        @JsonProperty("avg_repetition_ratio")
        Double avgRepetitionRatio,
        @JsonProperty("avg_sentence_length")
        Double avgSentenceLength,
        @JsonProperty("avg_appropriateness_score")
        Double avgAppropriatenessScore,
        @JsonProperty("avg_response_time_score")
        Double avgResponseTimeScore,
        @JsonProperty("avg_repetition_score")
        Double avgRepetitionScore,
        @JsonProperty("avg_answer_length_score")
        Double avgAnswerLengthScore,
        @JsonProperty("avg_final_score")
        Double avgFinalScore
) {
}
