package com.example.final_project.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {

	@Bean
	SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
		http
				.authorizeHttpRequests(authorize -> authorize.anyRequest().permitAll())
				.csrf(csrf -> csrf.disable())
				.formLogin(form -> form.disable())
				.oauth2Login(oauth2 -> oauth2
						.loginPage("/login.html")
						.defaultSuccessUrl("/main.html?login=success", true)
				)
				.logout(logout -> logout
						.logoutSuccessUrl("/main.html")
				)
				.httpBasic(httpBasic -> httpBasic.disable());

		return http.build();
	}
}