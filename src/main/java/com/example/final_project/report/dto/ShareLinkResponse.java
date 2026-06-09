package com.example.final_project.report.dto;

public record ShareLinkResponse(
        String shareUrl,
        String title,
        String description,
        String expiresAt
) {
}
