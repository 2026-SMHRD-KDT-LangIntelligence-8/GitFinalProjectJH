package com.example.final_project.report.dto;

public record CreateShareLinkRequest(
        Long recipientId,
        Long performanceId
) {
}
