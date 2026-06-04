package com.example.final_project.recipient;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 수급자 관리, 검사, 훈련 화면에서 공통으로 사용하는 REST API.
 * 목록 조회, 상세 조회, 등록, 수정 기능을 현재 범위에 맞게 제공한다.
 */
@RestController
@RequestMapping("/api/recipients")
public class RecipientController {

    private final RecipientService recipientService;

    public RecipientController(RecipientService recipientService) {
        this.recipientService = recipientService;
    }

    /**
     * 수급자 전체 목록을 조회한다.
     */
    @GetMapping
    public List<RecipientResponse> getRecipients() {
        return recipientService.getRecipients();
    }

    /**
     * 상세 화면에서 필요한 수급자 한 건을 조회한다.
     */
    @GetMapping("/{recipientId}")
    public RecipientResponse getRecipient(@PathVariable Long recipientId) {
        return recipientService.getRecipient(recipientId);
    }

    /**
     * 등록 페이지에서 입력한 수급자 정보를 저장한다.
     */
    @PostMapping
    public RecipientResponse createRecipient(@Valid @RequestBody RecipientCreateRequest request) {
        return recipientService.createRecipient(request);
    }

    /**
     * 수정 페이지에서 변경한 항목을 저장한다.
     */
    @PutMapping("/{recipientId}")
    public RecipientResponse updateRecipient(
            @PathVariable Long recipientId,
            @Valid @RequestBody RecipientUpdateRequest request
    ) {
        return recipientService.updateRecipient(recipientId, request);
    }
}
