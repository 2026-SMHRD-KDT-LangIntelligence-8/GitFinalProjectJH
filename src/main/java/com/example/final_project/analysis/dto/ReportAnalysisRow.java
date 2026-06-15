package com.example.final_project.analysis.dto;

// 리포트 요약 계산에 넘길 문항 단위 분석 입력 행이다.
public record ReportAnalysisRow(
        String questionTypeName,
        Double responseTime,
        Double repetitionRatio,
        Double avgSentenceLength,
        Integer appropriatenessScore
) {
}
