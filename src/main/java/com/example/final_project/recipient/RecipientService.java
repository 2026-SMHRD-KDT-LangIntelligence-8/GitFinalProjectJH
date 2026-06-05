package com.example.final_project.recipient;

import com.example.final_project.recipient.dto.RecipientCreateRequest;
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
     * 현재 카카오 사용자 ID를 기준으로 수급자 목록 조회를 위임한다.
     */
    public List<RecipientResponse> getRecipients(String userId) {
        return recipientRepository.findAllByUserId(userId);
    }

    /**
     * 현재 사용자와 수급자 매핑이 있을 때만 상세 정보를 조회한다.
     */
    public RecipientResponse getRecipient(Long recipientId, String userId) {
        return recipientRepository.findByIdAndUserId(recipientId, userId)
                .orElseThrow(() -> new IllegalArgumentException("해당 수급자를 찾을 수 없습니다. id=" + recipientId));
    }

    /**
     * 수급자 저장과 사용자-수급자 매핑 저장을 한 흐름으로 처리한다.
     */
    public RecipientResponse createRecipient(RecipientCreateRequest request, String userId) {
        return recipientRepository.save(request, userId);
    }

    /**
     * 현재 사용자와 연결된 수급자 데이터만 수정한다.
     */
    public RecipientResponse updateRecipient(Long recipientId, RecipientUpdateRequest request, String userId) {
        return recipientRepository.update(recipientId, request, userId);
    }
}
