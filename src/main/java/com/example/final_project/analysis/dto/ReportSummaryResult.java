package com.example.final_project.analysis.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.Map;

// 파이썬에서 계산한 전체 리포트 요약 JSON을 자바 객체로 받기 위한 DTO다.
public record ReportSummaryResult(
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
        Double avgFinalScore,
        @JsonProperty("question_type_summaries")
        Map<String, QuestionTypeSummary> questionTypeSummaries,
        List<Map<String, Object>> rows
) {
}
