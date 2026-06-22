package com.example.final_project.report.dto;

import java.util.List;

public record TrendReportResponse(
        Long recipientId,
        String recipientName,
        int periodDays,
        List<TrendPointResponse> points
) {
}
