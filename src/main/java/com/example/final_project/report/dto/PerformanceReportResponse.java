package com.example.final_project.report.dto;

import java.util.List;

public record PerformanceReportResponse(
        Long recipientId,
        String recipientName,
        Long performanceId,
        String performedAt,
        String reportType,
        List<QuestionTypeScoreResponse> questionTypeScores,
        List<QuestionScoreResponse> questionScores
) {
}
