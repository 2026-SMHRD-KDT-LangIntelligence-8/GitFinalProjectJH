package com.example.final_project.recipient;

import com.example.final_project.recipient.dto.RecipientCreateRequest;
import com.example.final_project.recipient.dto.RecipientDetailResponse;
import com.example.final_project.recipient.dto.RecipientNotesUpdateRequest;
import com.example.final_project.recipient.dto.RecipientResponse;
import com.example.final_project.recipient.dto.RecipientUpdateRequest;
import com.example.final_project.recipient.dto.TrainingStatusResponse;
import com.example.final_project.report.ReportService;
import com.example.final_project.report.dto.QuestionTypeScoreResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class RecipientService {

    private final RecipientRepository recipientRepository;
    private final ReportService reportService;

    public RecipientService(RecipientRepository recipientRepository, ReportService reportService) {
        this.recipientRepository = recipientRepository;
        this.reportService = reportService;
    }

    public List<RecipientResponse> getRecipients(String userId) {
        return recipientRepository.findAllByUserId(userId);
    }

    public RecipientResponse getRecipient(Long recipientId, String userId) {
        return recipientRepository.findByIdAndUserId(recipientId, userId)
                .orElseThrow(() -> new IllegalArgumentException("해당 수급자를 찾을 수 없습니다. id=" + recipientId));
    }

    public RecipientDetailResponse getRecipientDetail(Long recipientId, String userId) {
        RecipientDetailResponse detail = recipientRepository.findDetailByIdAndUserId(recipientId, userId)
                .orElseThrow(() -> new IllegalArgumentException("해당 수급자를 찾을 수 없습니다. id=" + recipientId));

        List<TrainingStatusResponse> trainingStatuses = reportService.getLatestQuestionTypeScores(recipientId, userId).stream()
                .map(this::toTrainingStatusResponse)
                .toList();

        return RecipientDetailResponse.builder()
                .recipientId(detail.getRecipientId())
                .recipientName(detail.getRecipientName())
                .birthDate(detail.getBirthDate())
                .gender(detail.getGender())
                .careGrade(detail.getCareGrade())
                .guardianName(detail.getGuardianName())
                .emergencyContact(detail.getEmergencyContact())
                .notes(detail.getNotes())
                .testCount(detail.getTestCount())
                .latestTestDate(detail.getLatestTestDate())
                .trainingStatuses(trainingStatuses)
                .build();
    }

    public RecipientResponse createRecipient(RecipientCreateRequest request, String userId) {
        return recipientRepository.save(request, userId);
    }

    public RecipientResponse updateRecipient(Long recipientId, RecipientUpdateRequest request, String userId) {
        return recipientRepository.update(recipientId, request, userId);
    }

    public RecipientDetailResponse updateRecipientNotes(
            Long recipientId,
            RecipientNotesUpdateRequest request,
            String userId
    ) {
        return recipientRepository.updateNotes(recipientId, request.getNotes(), userId);
    }

    @Transactional
    public void deleteRecipient(Long recipientId, String userId) {
        recipientRepository.deleteByIdAndUserId(recipientId, userId);
    }

    private TrainingStatusResponse toTrainingStatusResponse(QuestionTypeScoreResponse score) {
        int roundedScore = (int) Math.round(score.averageScore());
        return TrainingStatusResponse.builder()
                .questionTypeId(score.questionTypeId())
                .questionTypeName(score.questionTypeName())
                .averageAppropriatenessScore(roundedScore)
                .analyzedQuestionCount(0)
                .statusLabel(score.trainingNeeded() ? "훈련 필요" : "안정")
                .trainingNeeded(score.trainingNeeded())
                .build();
    }
}
