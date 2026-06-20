package com.example.final_project.report.dto;

public record PerformanceReportSummaryResponse(
        Long performanceId,
        String performedAt,
        String reportType
) {
}
