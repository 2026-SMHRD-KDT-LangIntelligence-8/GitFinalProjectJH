package com.example.final_project.recipient;

import jakarta.annotation.PostConstruct;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.Statement;
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

    @PostConstruct
    public void ensureUserMappingColumn() {
        Integer columnCount = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*)
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'RECIPIENTS'
                  AND COLUMN_NAME = 'user_id'
                """,
                Integer.class
        );

        if (columnCount != null && columnCount == 0) {
            jdbcTemplate.execute("ALTER TABLE RECIPIENTS ADD COLUMN user_id VARCHAR(255)");
            jdbcTemplate.execute("CREATE INDEX idx_recipients_user_id ON RECIPIENTS (user_id)");
        }
    }

    public List<RecipientResponse> findAllByUserId(String userId) {
        String sql = """
                SELECT recipient_id, recipient_name, birth_date, gender, care_grade, guardian_name, emergency_contact, notes
                FROM RECIPIENTS
                WHERE user_id = ?
                ORDER BY recipient_name ASC
                """;

        return jdbcTemplate.query(sql, RECIPIENT_ROW_MAPPER, userId);
    }

    public Optional<RecipientResponse> findByIdAndUserId(Long recipientId, String userId) {
        String sql = """
                SELECT recipient_id, recipient_name, birth_date, gender, care_grade, guardian_name, emergency_contact, notes
                FROM RECIPIENTS
                WHERE recipient_id = ?
                  AND user_id = ?
                """;

        List<RecipientResponse> results = jdbcTemplate.query(sql, RECIPIENT_ROW_MAPPER, recipientId, userId);
        return results.stream().findFirst();
    }

    public RecipientResponse save(RecipientCreateRequest request, String userId) {
        String sql = """
                INSERT INTO RECIPIENTS (
                    user_id,
                    recipient_name,
                    birth_date,
                    gender,
                    care_grade,
                    guardian_name,
                    emergency_contact,
                    notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """;

        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
            ps.setString(1, userId);
            ps.setString(2, request.getRecipientName());
            ps.setDate(3, Date.valueOf(request.getBirthDate()));
            ps.setString(4, request.getGender());
            ps.setString(5, request.getCareGrade());
            ps.setString(6, request.getGuardianName());
            ps.setString(7, request.getEmergencyContact());
            ps.setString(8, request.getNotes());
            return ps;
        }, keyHolder);

        Number generatedId = keyHolder.getKey();
        if (generatedId == null) {
            throw new IllegalStateException("Generated recipient id was not found.");
        }

        return findByIdAndUserId(generatedId.longValue(), userId)
                .orElseThrow(() -> new IllegalStateException("Saved recipient was not found."));
    }

    public RecipientResponse update(Long recipientId, RecipientUpdateRequest request, String userId) {
        String sql = """
                UPDATE RECIPIENTS
                SET birth_date = ?,
                    care_grade = ?,
                    guardian_name = ?,
                    emergency_contact = ?
                WHERE recipient_id = ?
                  AND user_id = ?
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
            throw new IllegalArgumentException("Recipient was not found. id=" + recipientId);
        }

        return findByIdAndUserId(recipientId, userId)
                .orElseThrow(() -> new IllegalStateException("Updated recipient was not found."));
    }

    public void deleteAllByUserId(String userId) {
        jdbcTemplate.update("DELETE FROM RECIPIENTS WHERE user_id = ?", userId);
    }
}
