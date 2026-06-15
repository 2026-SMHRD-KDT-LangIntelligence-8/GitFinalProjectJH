package com.example.final_project.report;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;

@Service
public class ReportShareTokenService {

    private static final String HMAC_ALGORITHM = "HmacSHA256";

    private final String secret;

    public ReportShareTokenService(
            @Value("${app.report.share-secret:dev-report-share-secret-change-me}") String secret
    ) {
        this.secret = secret;
    }

    public ShareTokenPayload createToken(String userId, Long recipientId, Long performanceId) {
        Instant expiresAt = Instant.now().plus(1, ChronoUnit.DAYS);
        String payload = userId + "|" + recipientId + "|" + performanceId + "|" + expiresAt.toEpochMilli();

        String token = encode(payload) + "." + encode(sign(payload));
        return new ShareTokenPayload(token, userId, recipientId, performanceId, expiresAt);
    }

    public ShareTokenPayload parseToken(String token) {
        if (token == null || token.isBlank() || !token.contains(".")) {
            throw new IllegalArgumentException("유효하지 않은 공유 토큰입니다.");
        }

        String[] parts = token.split("\\.", 2);
        String payload = decode(parts[0]);
        String expectedSignature = encode(sign(payload));

        if (!expectedSignature.equals(parts[1])) {
            throw new IllegalArgumentException("공유 토큰 검증에 실패했습니다.");
        }

        String[] values = payload.split("\\|");
        if (values.length != 4) {
            throw new IllegalArgumentException("공유 토큰 형식이 올바르지 않습니다.");
        }

        Instant expiresAt = Instant.ofEpochMilli(Long.parseLong(values[3]));
        if (expiresAt.isBefore(Instant.now())) {
            throw new IllegalArgumentException("공유 링크가 만료되었습니다.");
        }

        return new ShareTokenPayload(
                token,
                values[0],
                Long.parseLong(values[1]),
                Long.parseLong(values[2]),
                expiresAt
        );
    }

    private byte[] sign(String payload) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), HMAC_ALGORITHM));
            return mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
        } catch (Exception exception) {
            throw new IllegalStateException("공유 토큰 서명에 실패했습니다.", exception);
        }
    }

    private String encode(String value) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }

    private String encode(byte[] value) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(value);
    }

    private String decode(String value) {
        return new String(Base64.getUrlDecoder().decode(value), StandardCharsets.UTF_8);
    }

    public record ShareTokenPayload(
            String token,
            String userId,
            Long recipientId,
            Long performanceId,
            Instant expiresAt
    ) {
    }
}
