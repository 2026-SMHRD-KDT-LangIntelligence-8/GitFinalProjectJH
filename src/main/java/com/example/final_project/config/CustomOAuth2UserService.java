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

    private final DefaultOAuth2UserService delegate = new DefaultOAuth2UserService();
    private final JdbcTemplate jdbcTemplate;

    public CustomOAuth2UserService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    @Transactional
    public OAuth2User loadUser(OAuth2UserRequest userRequest) throws OAuth2AuthenticationException {
        OAuth2User oauth2User = delegate.loadUser(userRequest);

        // 카카오 로그인 사용자만 DB 저장 처리
        if ("kakao".equals(userRequest.getClientRegistration().getRegistrationId())) {
            saveKakaoUser(oauth2User);
        }

        return oauth2User;
    }

    @SuppressWarnings("unchecked")
    private void saveKakaoUser(OAuth2User oauth2User) {
        Map<String, Object> attributes = oauth2User.getAttributes();
        Map<String, Object> kakaoAccount = (Map<String, Object>) attributes.get("kakao_account");
        Map<String, Object> profile = kakaoAccount == null ? null : (Map<String, Object>) kakaoAccount.get("profile");

        // 카카오에서 제공하는 고유 ID와 닉네임 추출
        String kakaoId = String.valueOf(attributes.get("id"));
        String nickname = profile == null ? null : String.valueOf(profile.get("nickname"));

        if (kakaoId == null || kakaoId.isBlank()) {
            throw new OAuth2AuthenticationException(new OAuth2Error("kakao_id_not_found"), "Kakao id not found");
        }

        if (nickname == null || nickname.isBlank()) {
            throw new OAuth2AuthenticationException(new OAuth2Error("kakao_nickname_not_found"), "Kakao nickname not found");
        }

        // USERS 테이블에 같은 카카오 ID가 있는지 확인
        Integer count = jdbcTemplate.queryForObject(
                "select count(*) from USERS where user_id = ?",
                Integer.class,
                kakaoId
        );

        // 기존 회원이면 닉네임만 업데이트, 없으면 새로 저장
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
}