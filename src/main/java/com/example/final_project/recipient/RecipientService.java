package com.example.final_project.recipient;

import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class RecipientService {

    private final RecipientRepository recipientRepository;

    public RecipientService(RecipientRepository recipientRepository) {
        this.recipientRepository = recipientRepository;
    }

    public List<RecipientResponse> getRecipients(String userId) {
        return recipientRepository.findAllByUserId(userId);
    }

    public RecipientResponse getRecipient(Long recipientId, String userId) {
        return recipientRepository.findByIdAndUserId(recipientId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Recipient was not found. id=" + recipientId));
    }

    public RecipientResponse createRecipient(RecipientCreateRequest request, String userId) {
        return recipientRepository.save(request, userId);
    }

    public RecipientResponse updateRecipient(Long recipientId, RecipientUpdateRequest request, String userId) {
        return recipientRepository.update(recipientId, request, userId);
    }
}
