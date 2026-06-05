package com.example.final_project.user;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CurrentUserService {

    public String getRequiredUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        if (authentication == null || !(authentication.getPrincipal() instanceof OAuth2User oauth2User)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Login is required.");
        }

        Object kakaoId = oauth2User.getAttributes().get("id");
        String userId = String.valueOf(kakaoId);

        if (userId == null || userId.isBlank() || "null".equals(userId)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User id was not found.");
        }

        return userId;
    }
}
