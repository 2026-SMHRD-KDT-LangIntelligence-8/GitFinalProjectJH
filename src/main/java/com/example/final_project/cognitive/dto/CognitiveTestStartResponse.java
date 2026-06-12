package com.example.final_project.cognitive.dto;

import java.util.List;

public record CognitiveTestStartResponse(
        Long performanceId,
        Long recipientId,
        String recipientName,
        int questionsPerType,
        int totalQuestions,
        int questionDurationSeconds,
        List<String> weakQuestionTypeNames,
        List<CognitiveQuestionResponse> questions
) {
}
