package com.example.final_project.recipient.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

/**
 * Request DTO used by the recipient create page.
 * The browser sends this payload to POST /api/recipients.
 */
@Getter
@Setter
public class RecipientCreateRequest {

    @NotBlank(message = "Recipient name is required.")
    private String recipientName;

    @NotBlank(message = "Birth date is required.")
    private String birthDate;

    @NotBlank(message = "Gender is required.")
    private String gender;

    @NotBlank(message = "Care grade is required.")
    private String careGrade;

    private String guardianName;
    private String emergencyContact;
    private String notes;
}
