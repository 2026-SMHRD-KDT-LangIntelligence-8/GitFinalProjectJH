package com.example.final_project.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.SecurityFilterChain;

import java.util.Map;

@Configuration
public class SecurityConfig {

    private final OAuth2UserService<OAuth2UserRequest, OAuth2User> customOAuth2UserService;
    private final JdbcTemplate jdbcTemplate;

    public SecurityConfig(
            OAuth2UserService<OAuth2UserRequest, OAuth2User> customOAuth2UserService,
            JdbcTemplate jdbcTemplate
    ) {
        this.customOAuth2UserService = customOAuth2UserService;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .authorizeHttpRequests(authorize -> authorize
                        .requestMatchers(
                                "/",
                                "/login",
                                "/login.html",
                                "/main",
                                "/main.html",
                                "/oauth2/**",
                                "/login/oauth2/**",
                                "/css/**",
                                "/js/**",
                                "/img/**",
                                "/cognitive-images/**",
                                "/api/users/status"
                        ).permitAll()
                        .anyRequest().authenticated()
                )
                .csrf(csrf -> csrf.disable())
                .formLogin(form -> form.disable())
                .oauth2Login(oauth2 -> oauth2
                        .loginPage("/login")
                        .userInfoEndpoint(userInfo -> userInfo.userService(customOAuth2UserService))
                        .successHandler((request, response, authentication) -> {
                            OAuth2User oauth2User = (OAuth2User) authentication.getPrincipal();
                            String userId = String.valueOf(oauth2User.getAttributes().get("id"));
                            String targetUrl = hasCaregiverInfo(userId) ? "/main?login=success" : "/caregiver-info?login=success";
                            response.sendRedirect(targetUrl);
                        })
                )
                .logout(logout -> logout
                        .invalidateHttpSession(true)
                        .clearAuthentication(true)
                        .deleteCookies("JSESSIONID")
                        .logoutSuccessUrl("/login")
                )
                .httpBasic(httpBasic -> httpBasic.disable());

        return http.build();
    }

    private boolean hasCaregiverInfo(String userId) {
        Map<String, Object> caregiverInfo = jdbcTemplate.query(
                """
                SELECT care_worker_cert_no, agency_name
                FROM USERS
                WHERE user_id = ?
                """,
                rs -> {
                    if (!rs.next()) {
                        return Map.of();
                    }

                    return Map.of(
                            "caregiverLicenseNumber", rs.getString("care_worker_cert_no") == null ? "" : rs.getString("care_worker_cert_no"),
                            "organizationName", rs.getString("agency_name") == null ? "" : rs.getString("agency_name")
                    );
                },
                userId
        );

        return !String.valueOf(caregiverInfo.getOrDefault("caregiverLicenseNumber", "")).isBlank()
                && !String.valueOf(caregiverInfo.getOrDefault("organizationName", "")).isBlank();
    }
}
