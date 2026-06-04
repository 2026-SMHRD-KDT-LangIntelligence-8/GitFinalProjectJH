package com.example.final_project.recipient;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

/**
 * 수급자 수정 화면에서 사용하는 요청 DTO.
 * 현재 요구사항에 맞춰 보호자명, 비상연락망, 생년월일, 요양등급만 수정 대상으로 둔다.
 */
@Getter
@Setter
public class RecipientUpdateRequest {

    @NotBlank(message = "생년월일은 필수입니다.")
    private String birthDate;

    @NotBlank(message = "장기요양등급은 필수입니다.")
    private String careGrade;

    private String guardianName;
    private String emergencyContact;
}
