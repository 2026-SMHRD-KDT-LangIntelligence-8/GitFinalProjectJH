package com.example.final_project.user;

import com.example.final_project.recipient.RecipientRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.logout.CookieClearingLogoutHandler;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class UserController {

    // 회원 탈퇴 시 사용자 테이블과 수급자 연결 정보를 함께 정리해야 하므로 관련 의존성을 같이 받는다.
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

    @GetMapping("/status")
    public Map<String, Object> getAuthStatus(Authentication authentication) {
        boolean authenticated = authentication != null
                && authentication.isAuthenticated()
                && authentication.getPrincipal() instanceof OAuth2User;

        Map<String, Object> status = new HashMap<>();
        status.put("authenticated", authenticated);

        if (authenticated) {
            ensureCaregiverInfoColumns();
            String userId = currentUserService.getRequiredUserId();
            status.put("caregiverProfileCompleted", hasCaregiverInfo(userId));
        }

        return status;
    }

    @GetMapping("/me")
    public Map<String, Object> getCurrentUser() {
        ensureCaregiverInfoColumns();
        String userId = currentUserService.getRequiredUserId();
        return jdbcTemplate.query(
                """
                select user_name, email, phone_number, care_worker_cert_no, agency_name
                from USERS
                where user_id = ?
                """,
                rs -> {
                    Map<String, Object> user = new HashMap<>();
                    user.put("authenticated", true);
                    user.put("userId", userId);

                    if (rs.next()) {
                        user.put("userName", rs.getString("user_name"));
                        user.put("email", rs.getString("email"));
                        user.put("phoneNumber", rs.getString("phone_number"));
                        user.put("caregiverLicenseNumber", rs.getString("care_worker_cert_no"));
                        user.put("organizationName", rs.getString("agency_name"));
                    } else {
                        user.put("userName", "");
                        user.put("email", "");
                        user.put("phoneNumber", "");
                        user.put("caregiverLicenseNumber", "");
                        user.put("organizationName", "");
                    }

                    return user;
                },
                userId
        );
    }

    @GetMapping("/caregiver-info")
    public Map<String, Object> getCaregiverInfo() {
        return getCurrentUser();
    }

    @PutMapping("/caregiver-info")
    public Map<String, Object> updateCaregiverInfo(@RequestBody Map<String, String> request) {
        ensureCaregiverInfoColumns();
        String userId = currentUserService.getRequiredUserId();
        String caregiverLicenseNumber = sanitizeCaregiverLicenseNumber(
                request.getOrDefault("caregiverLicenseNumber", "")
        );
        String organizationName = request.getOrDefault("organizationName", "").trim();

        if (caregiverLicenseNumber.isBlank() || organizationName.isBlank()) {
            throw new IllegalArgumentException("요양보호사 자격번호와 소속 기관을 모두 입력해주세요.");
        }

        jdbcTemplate.update(
                """
                update USERS
                set care_worker_cert_no = ?,
                    agency_name = ?
                where user_id = ?
                """,
                caregiverLicenseNumber,
                organizationName,
                userId
        );

        return Map.of("message", "saved");
    }

    @PutMapping("/profile")
    public Map<String, Object> updateProfile(@RequestBody Map<String, String> request) {
        ensureCaregiverInfoColumns();
        String userId = currentUserService.getRequiredUserId();
        Map<String, String> storedProfile = getStoredProfile(userId);

        String requestedEmail = request.getOrDefault("email", "").trim();
        String requestedPhoneNumber = request.getOrDefault("phoneNumber", "").trim();
        String requestedCaregiverLicenseNumber = sanitizeCaregiverLicenseNumber(
                request.getOrDefault("caregiverLicenseNumber", "")
        );
        String requestedOrganizationName = request.getOrDefault("organizationName", "").trim();

        String email = requestedEmail.isBlank() ? storedProfile.get("email") : requestedEmail;
        String phoneNumber = requestedPhoneNumber.isBlank() ? storedProfile.get("phoneNumber") : requestedPhoneNumber;
        String caregiverLicenseNumber = requestedCaregiverLicenseNumber.isBlank()
                ? storedProfile.get("caregiverLicenseNumber")
                : requestedCaregiverLicenseNumber;
        String organizationName = requestedOrganizationName.isBlank()
                ? storedProfile.get("organizationName")
                : requestedOrganizationName;

        jdbcTemplate.update(
                """
                update USERS
                set email = ?,
                    phone_number = ?,
                    care_worker_cert_no = ?,
                    agency_name = ?
                where user_id = ?
                """,
                email,
                phoneNumber,
                caregiverLicenseNumber,
                organizationName,
                userId
        );

        return Map.of("message", "saved");
    }

    private Map<String, String> getStoredProfile(String userId) {
        return jdbcTemplate.query(
                """
                select email, phone_number, care_worker_cert_no, agency_name
                from USERS
                where user_id = ?
                """,
                rs -> {
                    Map<String, String> profile = new HashMap<>();
                    if (rs.next()) {
                        profile.put("email", defaultString(rs.getString("email")));
                        profile.put("phoneNumber", defaultString(rs.getString("phone_number")));
                        profile.put("caregiverLicenseNumber", defaultString(rs.getString("care_worker_cert_no")));
                        profile.put("organizationName", defaultString(rs.getString("agency_name")));
                    } else {
                        profile.put("email", "");
                        profile.put("phoneNumber", "");
                        profile.put("caregiverLicenseNumber", "");
                        profile.put("organizationName", "");
                    }
                    return profile;
                },
                userId
        );
    }

    @DeleteMapping("/me")
    @Transactional
    public Map<String, String> deleteCurrentUser(HttpServletRequest request, HttpServletResponse response) {
        // 로그아웃 처리에도 현재 인증 객체가 필요하므로 탈퇴 시작 시 먼저 꺼내 둔다.
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String userId = currentUserService.getRequiredUserId();

        // 회원 탈퇴 시 사용자 리포트와 수급자 관련 데이터를 먼저 정리한 뒤 사용자 정보를 삭제한다.
        jdbcTemplate.update("delete from REPORTS where user_id = ?", userId);
        recipientRepository.deleteAllByUserId(userId);
        jdbcTemplate.update("delete from USERS where user_id = ?", userId);
        // DB 정리 후 세션과 쿠키까지 비워야 브라우저에 로그인 흔적이 남지 않는다.
        new SecurityContextLogoutHandler().logout(request, response, authentication);
        new CookieClearingLogoutHandler("JSESSIONID").logout(request, response, authentication);

        return Map.of("message", "withdrawn");
    }

    private boolean hasCaregiverInfo(String userId) {
        return jdbcTemplate.query(
                """
                select care_worker_cert_no, agency_name
                from USERS
                where user_id = ?
                """,
                rs -> {
                    if (!rs.next()) {
                        return false;
                    }

                    String caregiverLicenseNumber = rs.getString("care_worker_cert_no");
                    String organizationName = rs.getString("agency_name");
                    return caregiverLicenseNumber != null && !caregiverLicenseNumber.isBlank()
                            && organizationName != null && !organizationName.isBlank();
                },
                userId
        );
    }

    private void ensureCaregiverInfoColumns() {
        ensureColumn("care_worker_cert_no", "varchar(100)");
        ensureColumn("agency_name", "varchar(255)");
        ensureColumn("email", "varchar(255)");
        ensureColumn("phone_number", "varchar(30)");
        dropColumnIfExists("caregiver_license_number");
        dropColumnIfExists("organization_name");
    }

    private String sanitizeCaregiverLicenseNumber(String value) {
        return value == null ? "" : value.replaceAll("\\D", "").trim();
    }

    private String defaultString(String value) {
        return value == null ? "" : value.trim();
    }

    private void ensureColumn(String columnName, String columnDefinition) {
        Integer columnCount = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*)
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'USERS'
                  AND COLUMN_NAME = ?
                """,
                Integer.class,
                columnName
        );

        if (columnCount == null || columnCount > 0) {
            return;
        }

        jdbcTemplate.execute("ALTER TABLE USERS ADD COLUMN " + columnName + " " + columnDefinition);
    }

    private void dropColumnIfExists(String columnName) {
        Integer columnCount = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*)
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'USERS'
                  AND COLUMN_NAME = ?
                """,
                Integer.class,
                columnName
        );

        if (columnCount == null || columnCount == 0) {
            return;
        }

        jdbcTemplate.execute("ALTER TABLE USERS DROP COLUMN " + columnName);
    }
}
