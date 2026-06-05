package com.example.final_project.recipient;

import com.example.final_project.recipient.dto.RecipientCreateRequest;
import com.example.final_project.recipient.dto.RecipientResponse;
import com.example.final_project.recipient.dto.RecipientUpdateRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Repository
public class RecipientRepository {

    private static final RowMapper<RecipientResponse> RECIPIENT_ROW_MAPPER = (rs, rowNum) -> {
        Date birthDate = rs.getDate("birth_date");

        return RecipientResponse.builder()
                .recipientId(rs.getLong("recipient_id"))
                .recipientName(rs.getString("recipient_name"))
                .birthDate(birthDate != null ? birthDate.toLocalDate().toString() : "")
                .gender(rs.getString("gender"))
                .careGrade(rs.getString("care_grade"))
                .guardianName(rs.getString("guardian_name"))
                .emergencyContact(rs.getString("emergency_contact"))
                .notes(rs.getString("notes"))
                .build();
    };

    private final JdbcTemplate jdbcTemplate;

    public RecipientRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /**
     * 현재 로그인한 카카오 사용자와 USER_RECIPIENTS로 연결된 수급자만 조회한다.
     * 수급자 관리 목록 화면은 이 조회 결과만 사용한다.
     */
    public List<RecipientResponse> findAllByUserId(String userId) {
        String sql = """
                SELECT r.recipient_id, r.recipient_name, r.birth_date, r.gender, r.care_grade,
                       r.guardian_name, r.emergency_contact, r.notes
                FROM RECIPIENTS r
                INNER JOIN USER_RECIPIENTS ur ON r.recipient_id = ur.recipient_id
                WHERE ur.user_id = ?
                ORDER BY r.recipient_name ASC
                """;

        return jdbcTemplate.query(sql, RECIPIENT_ROW_MAPPER, userId);
    }

    /**
     * 상세 조회도 USER_RECIPIENTS 매핑을 기준으로 제한하여 다른 사용자의 수급자에 접근하지 못하게 한다.
     */
    public Optional<RecipientResponse> findByIdAndUserId(Long recipientId, String userId) {
        String sql = """
                SELECT r.recipient_id, r.recipient_name, r.birth_date, r.gender, r.care_grade,
                       r.guardian_name, r.emergency_contact, r.notes
                FROM RECIPIENTS r
                INNER JOIN USER_RECIPIENTS ur ON r.recipient_id = ur.recipient_id
                WHERE r.recipient_id = ?
                  AND ur.user_id = ?
                """;

        List<RecipientResponse> results = jdbcTemplate.query(sql, RECIPIENT_ROW_MAPPER, recipientId, userId);
        return results.stream().findFirst();
    }

    /**
     * 수급자 기본 정보는 RECIPIENTS에 먼저 저장하고,
     * 생성된 recipient_id를 USER_RECIPIENTS에 현재 카카오 user_id와 함께 저장한다.
     * 이 매핑 정보가 있어야 등록한 사용자의 목록에 새 수급자가 보인다.
     */
    public RecipientResponse save(RecipientCreateRequest request, String userId) {
        String sql = """
                INSERT INTO RECIPIENTS (
                    recipient_name,
                    birth_date,
                    gender,
                    care_grade,
                    guardian_name,
                    emergency_contact,
                    notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """;

        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
            ps.setString(1, request.getRecipientName());
            ps.setDate(2, Date.valueOf(request.getBirthDate()));
            ps.setString(3, request.getGender());
            ps.setString(4, request.getCareGrade());
            ps.setString(5, request.getGuardianName());
            ps.setString(6, request.getEmergencyContact());
            ps.setString(7, request.getNotes());
            return ps;
        }, keyHolder);

        Number generatedId = keyHolder.getKey();
        if (generatedId == null) {
            throw new IllegalStateException("생성된 수급자 ID를 확인할 수 없습니다.");
        }

        jdbcTemplate.update(
                "INSERT INTO USER_RECIPIENTS (user_id, recipient_id) VALUES (?, ?)",
                userId,
                generatedId.longValue()
        );

        return findByIdAndUserId(generatedId.longValue(), userId)
                .orElseThrow(() -> new IllegalStateException("저장된 수급자 정보를 다시 조회하지 못했습니다."));
    }

    /**
     * 현재 사용자와 수급자 매핑이 있는 경우에만 수정이 가능하다.
     */
    public RecipientResponse update(Long recipientId, RecipientUpdateRequest request, String userId) {
        String sql = """
                UPDATE RECIPIENTS r
                INNER JOIN USER_RECIPIENTS ur ON r.recipient_id = ur.recipient_id
                SET r.birth_date = ?,
                    r.care_grade = ?,
                    r.guardian_name = ?,
                    r.emergency_contact = ?
                WHERE r.recipient_id = ?
                  AND ur.user_id = ?
                """;

        int updatedCount = jdbcTemplate.update(
                sql,
                Date.valueOf(request.getBirthDate()),
                request.getCareGrade(),
                request.getGuardianName(),
                request.getEmergencyContact(),
                recipientId,
                userId
        );

        if (updatedCount == 0) {
            throw new IllegalArgumentException("해당 수급자를 찾을 수 없습니다. id=" + recipientId);
        }

        return findByIdAndUserId(recipientId, userId)
                .orElseThrow(() -> new IllegalStateException("수정된 수급자 정보를 다시 조회하지 못했습니다."));
    }

    /**
     * 회원 탈퇴 시 먼저 USER_RECIPIENTS에서 현재 사용자의 매핑을 지우고,
     * 더 이상 어떤 사용자와도 연결되지 않은 수급자 데이터만 RECIPIENTS에서 삭제한다.
     */
    public void deleteAllByUserId(String userId) {
        List<Long> recipientIds = jdbcTemplate.queryForList(
                "SELECT recipient_id FROM USER_RECIPIENTS WHERE user_id = ?",
                Long.class,
                userId
        );

        jdbcTemplate.update("DELETE FROM USER_RECIPIENTS WHERE user_id = ?", userId);

        List<Long> orphanRecipientIds = new ArrayList<>();
        for (Long recipientId : recipientIds) {
            Integer mappingCount = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM USER_RECIPIENTS WHERE recipient_id = ?",
                    Integer.class,
                    recipientId
            );

            if (mappingCount != null && mappingCount == 0) {
                orphanRecipientIds.add(recipientId);
            }
        }

        for (Long recipientId : orphanRecipientIds) {
            jdbcTemplate.update("DELETE FROM RECIPIENTS WHERE recipient_id = ?", recipientId);
        }
    }
}
