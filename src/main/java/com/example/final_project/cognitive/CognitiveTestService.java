package com.example.final_project.cognitive;

import com.example.final_project.cognitive.dto.CognitiveQuestionResponse;
import com.example.final_project.cognitive.dto.CognitiveTestCompleteRequest;
import com.example.final_project.cognitive.dto.CognitiveTestStartRequest;
import com.example.final_project.cognitive.dto.CognitiveTestStartResponse;
import com.example.final_project.recipient.RecipientRepository;
import com.example.final_project.recipient.dto.RecipientResponse;
import com.example.final_project.user.CurrentUserService;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class CognitiveTestService {

    private static final String TEST_PURPOSE = "검사";
    private static final String TRAINING_PURPOSE = "훈련";
    private static final int QUESTION_TYPES_COUNT = 5;
    private static final int QUESTIONS_PER_TYPE = 5;

    private final CognitiveTestRepository cognitiveTestRepository;
    private final RecipientRepository recipientRepository;
    private final CurrentUserService currentUserService;

    public CognitiveTestService(
            CognitiveTestRepository cognitiveTestRepository,
            RecipientRepository recipientRepository,
            CurrentUserService currentUserService
    ) {
        this.cognitiveTestRepository = cognitiveTestRepository;
        this.recipientRepository = recipientRepository;
        this.currentUserService = currentUserService;
    }

    public CognitiveTestStartResponse startTest(CognitiveTestStartRequest request) {
        return startSession(request, TEST_PURPOSE);
    }

    public CognitiveTestStartResponse startTraining(CognitiveTestStartRequest request) {
        return startSession(request, TRAINING_PURPOSE);
    }

    public void completeTest(CognitiveTestCompleteRequest request) {
        String userId = currentUserService.getRequiredUserId();
        RecipientResponse recipient = recipientRepository.findByIdAndUserId(request.recipientId(), userId)
                .orElseThrow(() -> new IllegalArgumentException("해당 수급자를 찾을 수 없습니다. id=" + request.recipientId()));

        cognitiveTestRepository.savePerformanceRecord(recipient.getRecipientId(), userId);
    }

    private CognitiveTestStartResponse startSession(CognitiveTestStartRequest request, String questionPurpose) {
        String userId = currentUserService.getRequiredUserId();
        RecipientResponse recipient = recipientRepository.findByIdAndUserId(request.recipientId(), userId)
                .orElseThrow(() -> new IllegalArgumentException("해당 수급자를 찾을 수 없습니다. id=" + request.recipientId()));

        List<CognitiveQuestionResponse> questions =
                cognitiveTestRepository.findRandomQuestionsPerType(QUESTIONS_PER_TYPE, questionPurpose);

        int expectedQuestionCount = QUESTION_TYPES_COUNT * QUESTIONS_PER_TYPE;
        if (questions.size() != expectedQuestionCount) {
            throw new IllegalStateException(
                    questionPurpose + " 문항 수가 부족합니다. 예상=" + expectedQuestionCount + ", 실제=" + questions.size()
            );
        }

        return new CognitiveTestStartResponse(
                recipient.getRecipientId(),
                recipient.getRecipientName(),
                QUESTIONS_PER_TYPE,
                expectedQuestionCount,
                70,
                questions
        );
    }
}
