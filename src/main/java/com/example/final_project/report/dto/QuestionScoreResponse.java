package com.example.final_project.report.dto;

public record QuestionScoreResponse(
        Long questionId,
        Long questionResultId,
        String questionTypeName,
        String questionText,
        String answerText,
        Integer score,
        boolean trainingNeeded
) {
}