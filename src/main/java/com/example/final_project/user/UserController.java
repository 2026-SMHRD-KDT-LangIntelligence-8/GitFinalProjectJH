package com.example.final_project.user;

import com.example.final_project.recipient.RecipientRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.logout.CookieClearingLogoutHandler;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final JdbcTemplate jdbcTemplate;
    private final CurrentUserService currentUserService;
    private final RecipientRepository recipientRepository;

    public UserController(
            JdbcTemplate jdbcTemplate,
            CurrentUserService currentUserService,
            RecipientRepository recipientRepository
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.currentUserService = currentUserService;
        this.recipientRepository = recipientRepository;
    }

    @DeleteMapping("/me")
    @Transactional
    public Map<String, String> deleteCurrentUser(HttpServletRequest request, HttpServletResponse response) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String userId = currentUserService.getRequiredUserId();

        // 회원 탈퇴 시 사용자-수급자 매핑을 먼저 정리하고, 연결이 끊긴 수급자 데이터만 삭제한다.
        recipientRepository.deleteAllByUserId(userId);
        jdbcTemplate.update("delete from USERS where user_id = ?", userId);
        new SecurityContextLogoutHandler().logout(request, response, authentication);
        new CookieClearingLogoutHandler("JSESSIONID").logout(request, response, authentication);

        return Map.of("message", "withdrawn");
    }
}
