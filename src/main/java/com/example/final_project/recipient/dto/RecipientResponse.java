package com.example.final_project.recipient.dto;

import lombok.Builder;
import lombok.Getter;

/**
 * Response DTO shared by the recipient list, detail, edit, test, and training screens.
 */
@Getter
@Builder
public class RecipientResponse {
    private Long recipientId;
    private String recipientName;
    private String birthDate;
    private String gender;
    private String careGrade;
    private String guardianName;
    private String emergencyContact;
    private String notes;
}
