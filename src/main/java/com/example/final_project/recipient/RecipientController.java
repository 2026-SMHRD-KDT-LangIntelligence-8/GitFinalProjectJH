package com.example.final_project.recipient;

import com.example.final_project.recipient.dto.RecipientCreateRequest;
import com.example.final_project.recipient.dto.RecipientResponse;
import com.example.final_project.recipient.dto.RecipientUpdateRequest;
import com.example.final_project.user.CurrentUserService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/recipients")
public class RecipientController {

    private final RecipientService recipientService;
    private final CurrentUserService currentUserService;

    public RecipientController(RecipientService recipientService, CurrentUserService currentUserService) {
        this.recipientService = recipientService;
        this.currentUserService = currentUserService;
    }

    /**
     * Return only the recipients mapped to the currently logged-in Kakao user.
     * The frontend still calls /api/recipients without extra parameters.
     */
    @GetMapping
    public List<RecipientResponse> getRecipients() {
        return recipientService.getRecipients(currentUserService.getRequiredUserId());
    }

    /**
     * Allow detail lookup only when the current user-recipient mapping exists.
     */
    @GetMapping("/{recipientId}")
    public RecipientResponse getRecipient(@PathVariable Long recipientId) {
        return recipientService.getRecipient(recipientId, currentUserService.getRequiredUserId());
    }

    /**
     * Create a recipient and connect it to the current Kakao user in USER_RECIPIENTS.
     */
    @PostMapping
    public RecipientResponse createRecipient(@Valid @RequestBody RecipientCreateRequest request) {
        return recipientService.createRecipient(request, currentUserService.getRequiredUserId());
    }

    /**
     * Update only the recipients owned by the current Kakao user.
     */
    @PutMapping("/{recipientId}")
    public RecipientResponse updateRecipient(
            @PathVariable Long recipientId,
            @Valid @RequestBody RecipientUpdateRequest request
    ) {
        return recipientService.updateRecipient(recipientId, request, currentUserService.getRequiredUserId());
    }
}
