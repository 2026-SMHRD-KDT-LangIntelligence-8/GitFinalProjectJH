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

    // 현재 로그인 사용자 확인과 수급자 비즈니스 처리를 분리해 컨트롤러는 요청/응답 연결에만 집중한다.
    private final RecipientService recipientService;
    private final CurrentUserService currentUserService;

    public RecipientController(RecipientService recipientService, CurrentUserService currentUserService) {
        this.recipientService = recipientService;
        this.currentUserService = currentUserService;
    }

    /**
     * 현재 로그인한 카카오 사용자와 연결된 수급자만 목록으로 반환한다.
     * 프론트는 기존처럼 /api/recipients를 호출하고, 사용자 필터링은 서버에서 처리한다.
     */
    @GetMapping
    public List<RecipientResponse> getRecipients() {
        return recipientService.getRecipients(currentUserService.getRequiredUserId());
    }

    /**
     * 현재 사용자와 매핑된 수급자만 상세 조회할 수 있도록 제한한다.
     */
    @GetMapping("/{recipientId}")
    public RecipientResponse getRecipient(@PathVariable Long recipientId) {
        return recipientService.getRecipient(recipientId, currentUserService.getRequiredUserId());
    }

    /**
     * 수급자 등록 후 USER_RECIPIENTS에 현재 카카오 사용자와의 연결 정보를 함께 저장한다.
     */
    @PostMapping
    public RecipientResponse createRecipient(@Valid @RequestBody RecipientCreateRequest request) {
        return recipientService.createRecipient(request, currentUserService.getRequiredUserId());
    }

    /**
     * 현재 로그인한 사용자가 등록한 수급자만 수정할 수 있도록 제한한다.
     */
    @PutMapping("/{recipientId}")
    public RecipientResponse updateRecipient(
            @PathVariable Long recipientId,
            @Valid @RequestBody RecipientUpdateRequest request
    ) {
        return recipientService.updateRecipient(recipientId, request, currentUserService.getRequiredUserId());
    }
}
