package com.example.final_project.recipient;

import com.example.final_project.recipient.dto.RecipientCreateRequest;
import com.example.final_project.recipient.dto.RecipientDetailResponse;
import com.example.final_project.recipient.dto.RecipientResponse;
import com.example.final_project.recipient.dto.RecipientUpdateRequest;
import com.example.final_project.recipient.dto.TrainingStatusResponse;
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
     * 상세 화면에서 기본 정보와 검사 관련 요약을 한 번에 내려주기 위한 조회다.
     */
    public Optional<RecipientDetailResponse> findDetailByIdAndUserId(Long recipientId, String userId) {
        Optional<RecipientResponse> recipient = findByIdAndUserId(recipientId, userId);
        if (recipient.isEmpty()) {
            return Optional.empty();
        }

        long testCount = countPerformancesByRecipientIdAndUserId(recipientId, userId);
        String latestTestDate = findLatestPerformanceDateByRecipientIdAndUserId(recipientId, userId);

        RecipientResponse base = recipient.get();
        return Optional.of(
                RecipientDetailResponse.builder()
                        .recipientId(base.getRecipientId())
                        .recipientName(base.getRecipientName())
                        .birthDate(base.getBirthDate())
                        .gender(base.getGender())
                        .careGrade(base.getCareGrade())
                        .guardianName(base.getGuardianName())
                        .emergencyContact(base.getEmergencyContact())
                        .notes(base.getNotes())
                        .testCount(testCount)
                        .latestTestDate(latestTestDate)
                        .trainingStatuses(findTrainingStatusesByRecipientIdAndUserId(recipientId, userId))
                        .build()
        );
    }

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

    public RecipientResponse update(Long recipientId, RecipientUpdateRequest request, String userId) {
        String sql = """
                UPDATE RECIPIENTS r
                INNER JOIN USER_RECIPIENTS ur ON r.recipient_id = ur.recipient_id
                SET r.birth_date = ?,
                    r.gender = ?,
                    r.care_grade = ?,
                    r.guardian_name = ?,
                    r.emergency_contact = ?
                WHERE r.recipient_id = ?
                  AND ur.user_id = ?
                """;

        int updatedCount = jdbcTemplate.update(
                sql,
                Date.valueOf(request.getBirthDate()),
                request.getGender(),
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
     * 기타 특이사항 메모는 상세 화면에서 자주 바뀌므로 전용 UPDATE 문으로 분리한다.
     */
    public RecipientDetailResponse updateNotes(Long recipientId, String notes, String userId) {
        String sql = """
                UPDATE RECIPIENTS r
                INNER JOIN USER_RECIPIENTS ur ON r.recipient_id = ur.recipient_id
                SET r.notes = ?
                WHERE r.recipient_id = ?
                  AND ur.user_id = ?
                """;

        int updatedCount = jdbcTemplate.update(sql, notes, recipientId, userId);
        if (updatedCount == 0) {
            throw new IllegalArgumentException("해당 수급자를 찾을 수 없습니다. id=" + recipientId);
        }

        return findDetailByIdAndUserId(recipientId, userId)
                .orElseThrow(() -> new IllegalStateException("수정된 수급자 메모를 다시 조회하지 못했습니다."));
    }

    public void deleteAllByUserId(String userId) {
        List<Long> recipientIds = jdbcTemplate.queryForList(
                "SELECT recipient_id FROM USER_RECIPIENTS WHERE user_id = ?",
                Long.class,
                userId
        );

        for (Long recipientId : recipientIds) {
            deleteRecipientRelatedDataByRecipientIdAndUserId(recipientId, userId);
        }

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

    public void deleteByIdAndUserId(Long recipientId, String userId) {
        boolean exists = findByIdAndUserId(recipientId, userId).isPresent();
        if (!exists) {
            throw new IllegalArgumentException("해당 수급자를 찾을 수 없습니다. id=" + recipientId);
        }

        deleteRecipientRelatedDataByRecipientIdAndUserId(recipientId, userId);

        jdbcTemplate.update(
                "DELETE FROM USER_RECIPIENTS WHERE user_id = ? AND recipient_id = ?",
                userId,
                recipientId
        );

        Integer mappingCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM USER_RECIPIENTS WHERE recipient_id = ?",
                Integer.class,
                recipientId
        );

        if (mappingCount != null && mappingCount == 0) {
            jdbcTemplate.update("DELETE FROM RECIPIENTS WHERE recipient_id = ?", recipientId);
        }
    }

    private void deleteRecipientRelatedDataByRecipientIdAndUserId(Long recipientId, String userId) {
        jdbcTemplate.update(
                """
                DELETE FROM REPORTS
                WHERE recipient_id = ?
                  AND user_id = ?
                """,
                recipientId,
                userId
        );

        jdbcTemplate.update(
                """
                DELETE ar
                FROM ANALYSIS_RESULTS ar
                INNER JOIN QUESTION_RESULTS qr ON ar.question_result_id = qr.question_result_id
                INNER JOIN PERFORMANCE_RECORDS pr ON qr.performance_id = pr.performance_id
                WHERE pr.recipient_id = ?
                  AND pr.user_id = ?
                """,
                recipientId,
                userId
        );

        jdbcTemplate.update(
                """
                DELETE qr
                FROM QUESTION_RESULTS qr
                INNER JOIN PERFORMANCE_RECORDS pr ON qr.performance_id = pr.performance_id
                WHERE pr.recipient_id = ?
                  AND pr.user_id = ?
                """,
                recipientId,
                userId
        );

        jdbcTemplate.update(
                """
                DELETE FROM PERFORMANCE_RECORDS
                WHERE recipient_id = ?
                  AND user_id = ?
                """,
                recipientId,
                userId
        );
    }

    private long countPerformancesByRecipientIdAndUserId(Long recipientId, String userId) {
        Long count = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*)
                FROM PERFORMANCE_RECORDS
                WHERE recipient_id = ?
                  AND user_id = ?
                """,
                Long.class,
                recipientId,
                userId
        );

        return count != null ? count : 0L;
    }

    private String findLatestPerformanceDateByRecipientIdAndUserId(Long recipientId, String userId) {
        return jdbcTemplate.query(
                """
                SELECT DATE_FORMAT(MAX(performed_at), '%Y-%m-%d') AS latest_test_date
                FROM PERFORMANCE_RECORDS
                WHERE recipient_id = ?
                  AND user_id = ?
                """,
                rs -> rs.next() ? rs.getString("latest_test_date") : null,
                recipientId,
                userId
        );
    }

    private List<TrainingStatusResponse> findTrainingStatusesByRecipientIdAndUserId(Long recipientId, String userId) {
        String sql = """
                SELECT qt.question_type_name,
                       ROUND(AVG(ar.appropriateness_score)) AS average_appropriateness_score,
                       COUNT(ar.question_result_id) AS analyzed_question_count
                FROM PERFORMANCE_RECORDS pr
                INNER JOIN QUESTION_RESULTS qr ON pr.performance_id = qr.performance_id
                INNER JOIN ANALYSIS_RESULTS ar ON qr.question_result_id = ar.question_result_id
                INNER JOIN QUESTIONS q ON qr.question_id = q.question_id
                INNER JOIN QUESTION_TYPES qt ON q.question_type_id = qt.question_type_id
                WHERE pr.recipient_id = ?
                  AND pr.user_id = ?
                GROUP BY q.question_type_id, qt.question_type_name
                HAVING analyzed_question_count > 0
                ORDER BY average_appropriateness_score ASC, analyzed_question_count DESC
                LIMIT 3
                """;

        return jdbcTemplate.query(sql, (rs, rowNum) ->
                        TrainingStatusResponse.builder()
                                .questionTypeName(rs.getString("question_type_name"))
                                .averageAppropriatenessScore(rs.getInt("average_appropriateness_score"))
                                .analyzedQuestionCount(rs.getInt("analyzed_question_count"))
                                .statusLabel(rs.getInt("average_appropriateness_score") < 80 ? "훈련 필요" : "안정")
                                .build(),
                recipientId,
                userId
        );
    }
}
