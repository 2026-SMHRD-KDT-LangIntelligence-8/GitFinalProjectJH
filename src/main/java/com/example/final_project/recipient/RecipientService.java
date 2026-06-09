package com.example.final_project.recipient;

import com.example.final_project.recipient.dto.RecipientCreateRequest;
import com.example.final_project.recipient.dto.RecipientDetailResponse;
import com.example.final_project.recipient.dto.RecipientNotesUpdateRequest;
import com.example.final_project.recipient.dto.RecipientResponse;
import com.example.final_project.recipient.dto.RecipientUpdateRequest;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class RecipientService {

    private final RecipientRepository recipientRepository;

    public RecipientService(RecipientRepository recipientRepository) {
        this.recipientRepository = recipientRepository;
    }

    /**
     * 목록 화면에는 현재 로그인 사용자가 연결한 수급자 기본 정보만 내려준다.
     */
    public List<RecipientResponse> getRecipients(String userId) {
        return recipientRepository.findAllByUserId(userId);
    }

    /**
     * 수정 화면은 기존과 동일하게 수급자 기본 정보만 사용한다.
     */
    public RecipientResponse getRecipient(Long recipientId, String userId) {
        return recipientRepository.findByIdAndUserId(recipientId, userId)
                .orElseThrow(() -> new IllegalArgumentException("해당 수급자를 찾을 수 없습니다. id=" + recipientId));
    }

    /**
     * 상세 화면은 검사 횟수, 최근 검사일, 훈련 우선순위까지 함께 조회한다.
     */
    public RecipientDetailResponse getRecipientDetail(Long recipientId, String userId) {
        return recipientRepository.findDetailByIdAndUserId(recipientId, userId)
                .orElseThrow(() -> new IllegalArgumentException("해당 수급자를 찾을 수 없습니다. id=" + recipientId));
    }

    /**
     * 수급자 등록 시 사용자-수급자 매핑까지 함께 생성한다.
     */
    public RecipientResponse createRecipient(RecipientCreateRequest request, String userId) {
        return recipientRepository.save(request, userId);
    }

    /**
     * 수정은 현재 사용자에게 연결된 수급자 데이터에만 반영한다.
     */
    public RecipientResponse updateRecipient(Long recipientId, RecipientUpdateRequest request, String userId) {
        return recipientRepository.update(recipientId, request, userId);
    }

    /**
     * 기타 특이사항 메모는 상세 화면에서 즉시 저장할 수 있도록 별도 처리한다.
     */
    public RecipientDetailResponse updateRecipientNotes(
            Long recipientId,
            RecipientNotesUpdateRequest request,
            String userId
    ) {
        return recipientRepository.updateNotes(recipientId, request.getNotes(), userId);
    }
}
