package com.example.final_project.recipient;

import com.example.final_project.recipient.dto.RecipientCreateRequest;
import com.example.final_project.recipient.dto.RecipientDetailResponse;
import com.example.final_project.recipient.dto.RecipientNotesUpdateRequest;
import com.example.final_project.recipient.dto.RecipientResponse;
import com.example.final_project.recipient.dto.RecipientUpdateRequest;
import com.example.final_project.user.CurrentUserService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
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

    // 로그인 사용자 확인과 수급자 비즈니스 처리를 분리해 컨트롤러는 요청/응답 연결만 담당한다.
    private final RecipientService recipientService;
    private final CurrentUserService currentUserService;

    public RecipientController(RecipientService recipientService, CurrentUserService currentUserService) {
        this.recipientService = recipientService;
        this.currentUserService = currentUserService;
    }

    /**
     * 현재 로그인한 사용자에게 연결된 수급자만 목록으로 반환한다.
     */
    @GetMapping
    public List<RecipientResponse> getRecipients() {
        return recipientService.getRecipients(currentUserService.getRequiredUserId());
    }

    /**
     * 수정 화면에서 사용할 수급자 기본 정보만 조회한다.
     */
    @GetMapping("/{recipientId}")
    public RecipientResponse getRecipient(@PathVariable Long recipientId) {
        return recipientService.getRecipient(recipientId, currentUserService.getRequiredUserId());
    }

    /**
     * 상세 화면용으로 검사 횟수, 최근 검사일, 훈련 상태 요약까지 함께 조회한다.
     */
    @GetMapping("/{recipientId}/detail")
    public RecipientDetailResponse getRecipientDetail(@PathVariable Long recipientId) {
        return recipientService.getRecipientDetail(recipientId, currentUserService.getRequiredUserId());
    }

    /**
     * 수급자 등록 후 USER_RECIPIENTS에 현재 사용자와의 연결 정보까지 함께 저장한다.
     */
    @PostMapping
    public RecipientResponse createRecipient(@Valid @RequestBody RecipientCreateRequest request) {
        return recipientService.createRecipient(request, currentUserService.getRequiredUserId());
    }

    /**
     * 수정 페이지에서는 기본 정보 항목만 수정한다.
     */
    @PutMapping("/{recipientId}")
    public RecipientResponse updateRecipient(
            @PathVariable Long recipientId,
            @Valid @RequestBody RecipientUpdateRequest request
    ) {
        return recipientService.updateRecipient(recipientId, request, currentUserService.getRequiredUserId());
    }

    /**
     * 상세 화면의 기타 특이사항 메모는 별도 버튼으로 자주 저장되므로 전용 API로 분리한다.
     */
    @PutMapping("/{recipientId}/notes")
    public RecipientDetailResponse updateRecipientNotes(
            @PathVariable Long recipientId,
            @RequestBody RecipientNotesUpdateRequest request
    ) {
        return recipientService.updateRecipientNotes(recipientId, request, currentUserService.getRequiredUserId());
    }

    /**
     * 현재 로그인한 사용자에게 연결된 수급자와 관련 검사 데이터를 삭제한다.
     */
    @DeleteMapping("/{recipientId}")
    public void deleteRecipient(@PathVariable Long recipientId) {
        recipientService.deleteRecipient(recipientId, currentUserService.getRequiredUserId());
    }
}
