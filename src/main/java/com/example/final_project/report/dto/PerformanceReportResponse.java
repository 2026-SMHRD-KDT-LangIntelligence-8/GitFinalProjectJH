package com.example.final_project.report.dto;

import java.util.List;

public record PerformanceReportResponse(
        Long recipientId,
        String recipientName,
        Long performanceId,
        String performedAt,
        List<QuestionTypeScoreResponse> questionTypeScores
) {
}
