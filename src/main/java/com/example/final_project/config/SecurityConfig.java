package com.example.final_project.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {

	// 구현체에 직접 결합하지 않고 OAuth2 사용자 서비스 인터페이스로 주입받는다.
	private final OAuth2UserService<OAuth2UserRequest, OAuth2User> customOAuth2UserService;

	public SecurityConfig(OAuth2UserService<OAuth2UserRequest, OAuth2User> customOAuth2UserService) {
		this.customOAuth2UserService = customOAuth2UserService;
	}

	@Bean
	SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
		http
				.authorizeHttpRequests(authorize -> authorize.anyRequest().permitAll())
				.csrf(csrf -> csrf.disable())
				.formLogin(form -> form.disable())
				// 템플릿 Controller 경로(/login, /main)를 기준으로 로그인/로그아웃 흐름을 맞춘다.
				// 예전 /main.html 경로는 ViewController에서 함께 처리한다.
				.oauth2Login(oauth2 -> oauth2
						.loginPage("/login")
						.userInfoEndpoint(userInfo -> userInfo.userService(customOAuth2UserService))
						.defaultSuccessUrl("/main?login=success", true)
				)
				.logout(logout -> logout
						.logoutSuccessUrl("/main")
				)
				.httpBasic(httpBasic -> httpBasic.disable());

		return http.build();
	}
}
