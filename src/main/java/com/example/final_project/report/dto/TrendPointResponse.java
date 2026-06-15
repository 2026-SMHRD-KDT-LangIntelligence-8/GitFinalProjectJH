package com.example.final_project.report.dto;

import java.util.List;

public record TrendPointResponse(
        String performedDate,
        double averageScore,
        List<QuestionTypeScoreResponse> questionTypeScores
) {
}
