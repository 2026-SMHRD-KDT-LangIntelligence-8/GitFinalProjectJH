package com.example.final_project.cognitive.dto;

public record QuestionAudioUploadResponse(
        Long questionResultId,
        Long performanceId,
        Long questionId,
        String voiceFilePath
) {
}
