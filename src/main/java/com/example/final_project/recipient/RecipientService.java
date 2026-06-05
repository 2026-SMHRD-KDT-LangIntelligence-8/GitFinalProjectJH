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
     * Delegate list lookup to the repository with the current Kakao user id.
     */
    public List<RecipientResponse> getRecipients(String userId) {
        return recipientRepository.findAllByUserId(userId);
    }

    /**
     * Load one recipient only when the current user-recipient mapping exists.
     */
    public RecipientResponse getRecipient(Long recipientId, String userId) {
        return recipientRepository.findByIdAndUserId(recipientId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Recipient was not found. id=" + recipientId));
    }

    /**
     * Save the recipient row and the USER_RECIPIENTS mapping in one flow.
     */
    public RecipientResponse createRecipient(RecipientCreateRequest request, String userId) {
        return recipientRepository.save(request, userId);
    }

    /**
     * Update only the recipient rows connected to the current user.
     */
    public RecipientResponse updateRecipient(Long recipientId, RecipientUpdateRequest request, String userId) {
        return recipientRepository.update(recipientId, request, userId);
    }
}
