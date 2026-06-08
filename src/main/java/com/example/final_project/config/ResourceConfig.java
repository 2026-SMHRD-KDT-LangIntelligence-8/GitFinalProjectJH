package com.example.final_project.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class ResourceConfig implements WebMvcConfigurer {

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // 정적 이미지 파일은 템플릿 경로와 분리해도 같은 URL 규칙으로 접근할 수 있게 유지한다.
        // 템플릿 화면에서 /img/logo.png 같은 경로를 그대로 사용할 수 있도록
        // classpath:/img/ 아래 리소스를 /img/** URL로 노출한다.
        registry.addResourceHandler("/img/**")
                .addResourceLocations("classpath:/img/");
    }
}
