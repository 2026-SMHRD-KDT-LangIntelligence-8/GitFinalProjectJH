package com.example.final_project.recipient.dto;

import lombok.Builder;
import lombok.Getter;


/**
 * 수급자 조회 응답 DTO.
 * 수급자 관리 목록, 상세, 수정, 검사, 훈련 화면에서 공통으로 사용한다.
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
