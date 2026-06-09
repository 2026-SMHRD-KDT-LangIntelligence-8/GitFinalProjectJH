package com.example.final_project.report.dto;

public record TrendPointResponse(
        String performedDate,
        String questionTypeName,
        double averageScore
) {
}
