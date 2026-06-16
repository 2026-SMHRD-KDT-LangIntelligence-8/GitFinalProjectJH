plugins {
	java
	id("org.springframework.boot") version "4.0.6"
	id("io.spring.dependency-management") version "1.1.7"
}

group = "com.example"
version = "0.0.1-SNAPSHOT"

java {
	toolchain {
		languageVersion = JavaLanguageVersion.of(21)
	}
}

repositories {
	mavenCentral()
}

dependencies {
	// Spring Data JPA
	implementation("org.springframework.boot:spring-boot-starter-data-jpa")

	// Spring Security
	implementation("org.springframework.boot:spring-boot-starter-security")
	implementation("org.springframework.boot:spring-boot-starter-security-oauth2-client")

	// Thymeleaf
	implementation("org.springframework.boot:spring-boot-starter-thymeleaf")
	implementation("org.thymeleaf.extras:thymeleaf-extras-springsecurity6")

	// Validation
	implementation("org.springframework.boot:spring-boot-starter-validation")

	// Spring MVC Web
	// ObjectMapper 자동 Bean 등록도 보통 이 의존성을 통해 함께 처리된다.
	implementation("org.springframework.boot:spring-boot-starter-web")

	// 음성 분석 파이프라인과 JSON 결과 파싱에 사용하는 Jackson 의존성이다.
	implementation("com.fasterxml.jackson.core:jackson-databind")

	// MyBatis
	implementation("org.mybatis.spring.boot:mybatis-spring-boot-starter:4.0.1")

	// Lombok
	compileOnly("org.projectlombok:lombok")
	annotationProcessor("org.projectlombok:lombok")

	// Devtools
	developmentOnly("org.springframework.boot:spring-boot-devtools")

	// MariaDB
	runtimeOnly("org.mariadb.jdbc:mariadb-java-client")

	// Test
	testImplementation("org.springframework.boot:spring-boot-starter-test")
	testImplementation("org.springframework.boot:spring-boot-starter-security-test")
	testImplementation("org.mybatis.spring.boot:mybatis-spring-boot-starter-test:4.0.1")

	testCompileOnly("org.projectlombok:lombok")
	testAnnotationProcessor("org.projectlombok:lombok")
	testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.withType<Test> {
	useJUnitPlatform()
}