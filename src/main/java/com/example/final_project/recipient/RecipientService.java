package com.example.final_project.recipient;

import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 수급자 화면에서 필요한 조회, 등록, 수정 흐름을 묶는 서비스.
 * Controller가 DB 세부 구현을 직접 알지 않도록 한 단계 분리해 둔다.
 */
@Service
public class RecipientService {

    private final RecipientRepository recipientRepository;

    public RecipientService(RecipientRepository recipientRepository) {
        this.recipientRepository = recipientRepository;
    }

    public List<RecipientResponse> getRecipients() {
        return recipientRepository.findAll();
    }

    public RecipientResponse getRecipient(Long recipientId) {
        return recipientRepository.findById(recipientId)
                .orElseThrow(() -> new IllegalArgumentException("해당 수급자를 찾을 수 없습니다. id=" + recipientId));
    }

    /**
     * 등록 페이지에서 받은 입력값을 저장소에 전달한다.
     */
    public RecipientResponse createRecipient(RecipientCreateRequest request) {
        return recipientRepository.save(request);
    }

    /**
     * 수정 페이지에서 변경한 값을 저장소에 전달한다.
     */
    public RecipientResponse updateRecipient(Long recipientId, RecipientUpdateRequest request) {
        return recipientRepository.update(recipientId, request);
    }
}
