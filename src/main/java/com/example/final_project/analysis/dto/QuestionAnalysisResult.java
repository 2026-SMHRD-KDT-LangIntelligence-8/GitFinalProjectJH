package com.example.final_project.analysis.dto;

// 문항 1개 음성에 대한 STT 결과와 채점 결과를 자바에서 묶어 다루기 위한 DTO다.
public record QuestionAnalysisResult(
        String sttText,
        String preprocessedText,
        Double responseTime,
        Double repetitionRatio,
        Double avgSentenceLength,
        Integer appropriatenessScore,
        Integer repetitionScore,
        Integer sentenceLengthScore,
        Double finalScore
) {
}
