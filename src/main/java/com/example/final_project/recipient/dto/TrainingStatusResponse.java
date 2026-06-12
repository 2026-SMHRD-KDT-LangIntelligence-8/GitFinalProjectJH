package com.example.final_project.recipient.dto;

import lombok.Builder;
import lombok.Getter;

/**
 * 수급자 상세 화면의 훈련 현황 조회 영역에 표시할 훈련 우선순위 정보를 담는다.
 */
@Getter
@Builder
public class TrainingStatusResponse {
    private Long questionTypeId;
    private String questionTypeName;
    private Integer averageAppropriatenessScore;
    private Integer analyzedQuestionCount;
    private String statusLabel;
    private boolean trainingNeeded;
}
