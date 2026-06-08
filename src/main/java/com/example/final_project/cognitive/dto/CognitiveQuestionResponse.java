package com.example.final_project.cognitive.dto;

public record CognitiveQuestionResponse(
        Long questionId,
        Long questionTypeId,
        String questionTypeName,
        String questionText,
        String questionPurpose,
        String imageFilePath,
        String imageDescriptionCriteria,
        Integer questionSequence
) {
}
