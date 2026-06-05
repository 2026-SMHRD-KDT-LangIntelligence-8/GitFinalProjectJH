package com.example.final_project.recipient;

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

    @GetMapping
    public List<RecipientResponse> getRecipients() {
        return recipientService.getRecipients(currentUserService.getRequiredUserId());
    }

    @GetMapping("/{recipientId}")
    public RecipientResponse getRecipient(@PathVariable Long recipientId) {
        return recipientService.getRecipient(recipientId, currentUserService.getRequiredUserId());
    }

    @PostMapping
    public RecipientResponse createRecipient(@Valid @RequestBody RecipientCreateRequest request) {
        return recipientService.createRecipient(request, currentUserService.getRequiredUserId());
    }

    @PutMapping("/{recipientId}")
    public RecipientResponse updateRecipient(
            @PathVariable Long recipientId,
            @Valid @RequestBody RecipientUpdateRequest request
    ) {
        return recipientService.updateRecipient(recipientId, request, currentUserService.getRequiredUserId());
    }
}
