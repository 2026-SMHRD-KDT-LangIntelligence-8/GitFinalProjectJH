package com.example.final_project.config;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationFailureHandler;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;

@Configuration
public class SecurityConfig {

	private static final Logger log = LoggerFactory.getLogger(SecurityConfig.class);

	private final OAuth2UserService<OAuth2UserRequest, OAuth2User> oauth2UserService;
	private final ClientRegistrationRepository clientRegistrationRepository;

	public SecurityConfig(
		OAuth2UserService<OAuth2UserRequest, OAuth2User> oauth2UserService,
		ObjectProvider<ClientRegistrationRepository> clientRegistrationRepositoryProvider
	) {
		this.oauth2UserService = oauth2UserService;
		this.clientRegistrationRepository = clientRegistrationRepositoryProvider.getIfAvailable();
	}

	@Bean
	SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
		http
			.authorizeHttpRequests(authorize -> authorize
				.requestMatchers(
					"/",
					"/login",
					"/api/auth/status",
					"/error",
					"/oauth2/**",
					"/login/oauth2/**",
					"/css/**",
					"/js/**",
					"/images/**",
					"/prototypes/main.html",
					"/prototypes/login.html",
					"/prototypes/social-login.html",
					"/prototypes/signup.html"
				).permitAll()
				.anyRequest().authenticated()
			)
			.csrf(csrf -> csrf.disable())
			.formLogin(form -> form.disable())
			.httpBasic(httpBasic -> httpBasic.disable())
			.logout(logout -> logout
				.logoutUrl("/logout")
				.invalidateHttpSession(true)
				.clearAuthentication(true)
				.deleteCookies("JSESSIONID")
				.logoutSuccessUrl("/prototypes/login.html")
			);

		if (clientRegistrationRepository != null) {
			http.oauth2Login(oauth2 -> oauth2
				.loginPage("/prototypes/login.html")
				.authorizationEndpoint(authorization -> authorization
					.authorizationRequestResolver(authorizationRequestResolver())
				)
				.successHandler(successHandler())
				.failureHandler(failureHandler())
				.userInfoEndpoint(userInfo -> userInfo.userService(oauth2UserService))
			);
		}

		return http.build();
	}

	@Bean
	SimpleUrlAuthenticationSuccessHandler successHandler() {
		SimpleUrlAuthenticationSuccessHandler handler =
			new SimpleUrlAuthenticationSuccessHandler("/prototypes/main.html");
		handler.setAlwaysUseDefaultTargetUrl(true);
		return handler;
	}

	@Bean
	SimpleUrlAuthenticationFailureHandler failureHandler() {
		return new SimpleUrlAuthenticationFailureHandler() {
			@Override
			public void onAuthenticationFailure(
				jakarta.servlet.http.HttpServletRequest request,
				jakarta.servlet.http.HttpServletResponse response,
				org.springframework.security.core.AuthenticationException exception
			) throws IOException, jakarta.servlet.ServletException {
				log.error("OAuth2 login failed: {}", exception.getMessage(), exception);
				String errorMessage = URLEncoder.encode(exception.getMessage(), StandardCharsets.UTF_8);
				getRedirectStrategy().sendRedirect(request, response, "/prototypes/social-login.html?error=" + errorMessage);
			}
		};
	}

	@Bean
	OAuth2AuthorizationRequestResolver authorizationRequestResolver() {
		if (clientRegistrationRepository == null) {
			throw new IllegalStateException("OAuth client registrations are not configured.");
		}

		DefaultOAuth2AuthorizationRequestResolver defaultResolver =
			new DefaultOAuth2AuthorizationRequestResolver(clientRegistrationRepository, "/oauth2/authorization");

		return new OAuth2AuthorizationRequestResolver() {
			@Override
			public OAuth2AuthorizationRequest resolve(jakarta.servlet.http.HttpServletRequest request) {
				return customizeAuthorizationRequest(defaultResolver.resolve(request), request);
			}

			@Override
			public OAuth2AuthorizationRequest resolve(
				jakarta.servlet.http.HttpServletRequest request,
				String clientRegistrationId
			) {
				return customizeAuthorizationRequest(defaultResolver.resolve(request, clientRegistrationId), request);
			}
		};
	}

	private OAuth2AuthorizationRequest customizeAuthorizationRequest(
		OAuth2AuthorizationRequest request,
		jakarta.servlet.http.HttpServletRequest httpRequest
	) {
		if (request == null) {
			return null;
		}

		String requestUri = httpRequest.getRequestURI();

		if (requestUri.endsWith("/google")) {
			return OAuth2AuthorizationRequest.from(request)
				.additionalParameters(parameters -> parameters.put("prompt", "select_account"))
				.build();
		}

		if (requestUri.endsWith("/kakao")) {
			return OAuth2AuthorizationRequest.from(request)
				.additionalParameters(parameters -> parameters.put("prompt", "login"))
				.build();
		}

		return request;
	}
}
