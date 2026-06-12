package com.example.final_project.report.dto;

public record QuestionTypeScoreResponse(
        Long questionTypeId,
        String questionTypeName,
        double averageScore,
        boolean trainingNeeded
) {
}
