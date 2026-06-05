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
     * Show only the recipients mapped to the currently logged-in Kakao user.
     * USER_RECIPIENTS is the ownership table used by the recipient list screen.
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
     * Detail lookup is also protected by USER_RECIPIENTS so that a user cannot open another user's recipient.
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
     * Save the recipient to RECIPIENTS first, then connect it to the Kakao user in USER_RECIPIENTS.
     * The mapping row is what makes the newly created recipient appear in that user's list.
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
            throw new IllegalStateException("Generated recipient id was not found.");
        }

        jdbcTemplate.update(
                "INSERT INTO USER_RECIPIENTS (user_id, recipient_id) VALUES (?, ?)",
                userId,
                generatedId.longValue()
        );

        return findByIdAndUserId(generatedId.longValue(), userId)
                .orElseThrow(() -> new IllegalStateException("Saved recipient was not found."));
    }

    /**
     * Update is allowed only when the current user-recipient mapping exists.
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
            throw new IllegalArgumentException("Recipient was not found. id=" + recipientId);
        }

        return findByIdAndUserId(recipientId, userId)
                .orElseThrow(() -> new IllegalStateException("Updated recipient was not found."));
    }

    /**
     * Remove the current user's mappings first.
     * Then delete recipient rows only when they are no longer mapped to any user.
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
