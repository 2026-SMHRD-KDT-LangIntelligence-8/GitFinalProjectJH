package com.example.final_project.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Path;

@Configuration
public class ResourceConfig implements WebMvcConfigurer {

    private final String cognitiveImageDir;

    public ResourceConfig(@Value("${app.cognitive.image-dir:./cognitive-images}") String cognitiveImageDir) {
        this.cognitiveImageDir = cognitiveImageDir;
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/img/**")
                .addResourceLocations("classpath:/img/");

        String normalizedImageDir = Path.of(cognitiveImageDir).toAbsolutePath().normalize().toUri().toString();
        if (!normalizedImageDir.endsWith("/")) {
            normalizedImageDir += "/";
        }

        // 문제 이미지 압축파일을 풀어 둔 폴더를 브라우저에서 바로 읽을 수 있게 노출한다.
        registry.addResourceHandler("/cognitive-images/**")
                .addResourceLocations(normalizedImageDir);
    }
}
