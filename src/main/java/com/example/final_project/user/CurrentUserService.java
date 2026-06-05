package com.example.final_project.user;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CurrentUserService {

    /**
     * 현재 인증된 OAuth2 사용자 정보에서 카카오 고유 ID를 읽어온다.
     * 이 값은 USERS.user_id와 USER_RECIPIENTS.user_id에 동일하게 저장된다.
     */
    public String getRequiredUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        if (authentication == null || !(authentication.getPrincipal() instanceof OAuth2User oauth2User)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");
        }

        Object kakaoId = oauth2User.getAttributes().get("id");
        String userId = String.valueOf(kakaoId);

        if (userId == null || userId.isBlank() || "null".equals(userId)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "사용자 ID를 확인할 수 없습니다.");
        }

        return userId;
    }
}
