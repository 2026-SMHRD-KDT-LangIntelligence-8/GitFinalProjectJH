package com.example.final_project.cognitive.dto;

// 음성 업로드 직후 프론트가 바로 사용할 수 있도록 STT와 채점 결과를 함께 내려준다.
public record QuestionAudioUploadResponse(
        Long questionResultId,
        Long performanceId,
        Long questionId,
        String voiceFilePath,
        String sttText,
        String preprocessedText,
        Integer appropriatenessScore,
        Integer repetitionScore,
        Integer sentenceLengthScore,
        Double finalScore
) {
}
