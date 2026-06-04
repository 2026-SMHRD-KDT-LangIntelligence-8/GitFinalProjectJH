package com.example.final_project.recipient;

import lombok.Builder;
import lombok.Getter;

/**
 * 화면으로 내려줄 수급자 조회 응답 DTO.
 * 관리 목록, 검사/훈련 드롭다운, 상세/수정 화면이 같은 응답 구조를 사용한다.
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
