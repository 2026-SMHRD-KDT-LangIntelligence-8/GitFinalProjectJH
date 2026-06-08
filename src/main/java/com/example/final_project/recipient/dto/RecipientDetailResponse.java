package com.example.final_project.recipient.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

/**
 * 수급자 상세 화면 전용 응답으로 기본 정보와 검사/훈련 현황 요약을 함께 담는다.
 */
@Getter
@Builder
public class RecipientDetailResponse {
    private Long recipientId;
    private String recipientName;
    private String birthDate;
    private String gender;
    private String careGrade;
    private String guardianName;
    private String emergencyContact;
    private String notes;
    private long testCount;
    private String latestTestDate;
    private List<TrainingStatusResponse> trainingStatuses;
}
