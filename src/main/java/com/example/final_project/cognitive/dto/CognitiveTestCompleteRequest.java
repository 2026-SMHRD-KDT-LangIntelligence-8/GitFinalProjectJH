package com.example.final_project.cognitive.dto;

import jakarta.validation.constraints.NotNull;

public record CognitiveTestCompleteRequest(
        @NotNull Long recipientId
) {
}
