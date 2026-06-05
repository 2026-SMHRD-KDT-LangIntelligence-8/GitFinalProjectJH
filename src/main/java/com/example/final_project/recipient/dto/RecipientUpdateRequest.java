package com.example.final_project.recipient.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

/**
 * Request DTO used by the recipient edit page.
 * Only the fields editable on the UI are included here.
 */
@Getter
@Setter
public class RecipientUpdateRequest {

    @NotBlank(message = "Birth date is required.")
    private String birthDate;

    @NotBlank(message = "Care grade is required.")
    private String careGrade;

    private String guardianName;
    private String emergencyContact;
}
