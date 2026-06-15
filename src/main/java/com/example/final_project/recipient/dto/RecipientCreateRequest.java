package com.example.final_project.recipient.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

/**
 * 수급자 등록 페이지에서 사용하는 요청 DTO.
 * 화면에서 입력한 값을 POST /api/recipients 요청 바디로 전달할 때 사용한다.
 */
@Getter
@Setter
public class RecipientCreateRequest {

    @NotBlank(message = "수급자명은 필수 입력입니다.")
    private String recipientName;

    @NotBlank(message = "생년월일은 필수 입력입니다.")
    private String birthDate;

    @NotBlank(message = "성별은 필수 입력입니다.")
    private String gender;

    @NotBlank(message = "장기요양등급은 필수 입력입니다.")
    private String careGrade;

    private String guardianName;
    @NotBlank(message = "비상연락망은 필수 입력입니다.")
    private String emergencyContact;
    private String notes;
}
