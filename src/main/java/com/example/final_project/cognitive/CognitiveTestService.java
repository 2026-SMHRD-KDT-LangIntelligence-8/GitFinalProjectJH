package com.example.final_project.cognitive;

import com.example.final_project.cognitive.dto.CognitiveQuestionResponse;
import com.example.final_project.cognitive.dto.CognitiveTestStartRequest;
import com.example.final_project.cognitive.dto.CognitiveTestStartResponse;
import com.example.final_project.recipient.RecipientRepository;
import com.example.final_project.recipient.dto.RecipientResponse;
import com.example.final_project.user.CurrentUserService;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class CognitiveTestService {

    // 현재 검사 정책은 5개 유형 * 유형당 5문항 = 총 25문항이다.
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

    /**
     * 로그인 사용자에게 연결된 수급자인지 먼저 확인하고,
     * 문제 유형별 랜덤 5문항씩 총 25문항을 시작 응답으로 내려준다.
     */
    public CognitiveTestStartResponse startTest(CognitiveTestStartRequest request) {
        String userId = currentUserService.getRequiredUserId();
        RecipientResponse recipient = recipientRepository.findByIdAndUserId(request.recipientId(), userId)
                .orElseThrow(() -> new IllegalArgumentException("해당 수급자를 찾을 수 없습니다. id=" + request.recipientId()));

        List<CognitiveQuestionResponse> questions =
                cognitiveTestRepository.findRandomQuestionsPerType(QUESTIONS_PER_TYPE);

        int expectedQuestionCount = QUESTION_TYPES_COUNT * QUESTIONS_PER_TYPE;
        if (questions.size() != expectedQuestionCount) {
            throw new IllegalStateException("검사 문항 수가 부족합니다. 예상=" + expectedQuestionCount + ", 실제=" + questions.size());
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
