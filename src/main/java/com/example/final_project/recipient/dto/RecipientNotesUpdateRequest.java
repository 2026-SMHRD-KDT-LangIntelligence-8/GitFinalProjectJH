package com.example.final_project.recipient.dto;

import lombok.Getter;
import lombok.Setter;

/**
 * 수급자 상세 화면에서 기타 특이사항 메모만 저장할 때 사용하는 요청 DTO.
 */
@Getter
@Setter
public class RecipientNotesUpdateRequest {
    private String notes;
}
