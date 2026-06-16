package com.example.final_project.config;

import java.util.Map;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CustomOAuth2UserService implements OAuth2UserService<OAuth2UserRequest, OAuth2User> {

    // 스프링 기본 OAuth2 사용자 조회 결과를 받아온 뒤, 우리 서비스용 사용자 저장 로직을 덧붙인다.
    private final DefaultOAuth2UserService delegate = new DefaultOAuth2UserService();
    private final JdbcTemplate jdbcTemplate;

    public CustomOAuth2UserService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    @Transactional
    public OAuth2User loadUser(OAuth2UserRequest userRequest) throws OAuth2AuthenticationException {
        // 먼저 카카오에서 내려준 사용자 정보를 기본 구현체로 조회한다.
        OAuth2User oauth2User = delegate.loadUser(userRequest);

        // 수급자 소유권 매핑은 카카오 고유 ID를 기준으로 하므로 카카오 로그인 사용자만 저장한다.
        if ("kakao".equals(userRequest.getClientRegistration().getRegistrationId())) {
            saveKakaoUser(oauth2User);
        }

        return oauth2User;
    }

    @SuppressWarnings("unchecked")
    private void saveKakaoUser(OAuth2User oauth2User) {
        ensureCaregiverInfoColumns();

        // 카카오 응답 구조가 중첩 Map 형태라 필요한 영역만 단계적으로 꺼낸다.
        Map<String, Object> attributes = oauth2User.getAttributes();
        Map<String, Object> kakaoAccount = (Map<String, Object>) attributes.get("kakao_account");
        Map<String, Object> profile = kakaoAccount == null ? null : (Map<String, Object>) kakaoAccount.get("profile");

        // OAuth 응답에서 카카오 고유 ID와 닉네임을 추출한다.
        String kakaoId = String.valueOf(attributes.get("id"));
        String nickname = profile == null ? null : String.valueOf(profile.get("nickname"));

        if (kakaoId == null || kakaoId.isBlank()) {
            throw new OAuth2AuthenticationException(new OAuth2Error("kakao_id_not_found"), "Kakao id not found");
        }

        if (nickname == null || nickname.isBlank()) {
            throw new OAuth2AuthenticationException(new OAuth2Error("kakao_nickname_not_found"), "Kakao nickname not found");
        }

        // USERS.user_id에는 카카오 고유 ID를 저장한다.
        // USER_RECIPIENTS.user_id도 같은 값을 사용하여 사용자와 수급자를 연결한다.
        Integer count = jdbcTemplate.queryForObject(
                "select count(*) from USERS where user_id = ?",
                Integer.class,
                kakaoId
        );

        // 카카오 ID는 유지하고, 재로그인 시에는 화면 표시용 닉네임만 갱신한다.
        if (count != null && count > 0) {
            jdbcTemplate.update(
                    "update USERS set user_name = ? where user_id = ?",
                    nickname, kakaoId
            );
        } else {
            jdbcTemplate.update(
                    "insert into USERS (user_id, user_name) values (?, ?)",
                    kakaoId, nickname
            );
        }
    }

    private void ensureCaregiverInfoColumns() {
        ensureColumn("care_worker_cert_no", "varchar(100)");
        ensureColumn("agency_name", "varchar(255)");
        ensureColumn("email", "varchar(255)");
        ensureColumn("phone_number", "varchar(30)");
        dropColumnIfExists("caregiver_license_number");
        dropColumnIfExists("organization_name");
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
