package com.example.final_project.recipient;

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

/**
 * RECIPIENTS 테이블에 직접 접근하는 저장소.
 * 현재 프로젝트에서는 JdbcTemplate 기반으로 조회, 등록, 수정 기능을 제공한다.
 */
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
     * 수급자 전체 목록을 이름 기준으로 정렬해서 조회한다.
     */
    public List<RecipientResponse> findAll() {
        String sql = """
                SELECT recipient_id, recipient_name, birth_date, gender, care_grade, guardian_name, emergency_contact, notes
                FROM RECIPIENTS
                ORDER BY recipient_name ASC
                """;

        return jdbcTemplate.query(sql, RECIPIENT_ROW_MAPPER);
    }

    /**
     * 상세 화면 진입 시 수급자 한 건을 조회한다.
     */
    public Optional<RecipientResponse> findById(Long recipientId) {
        String sql = """
                SELECT recipient_id, recipient_name, birth_date, gender, care_grade, guardian_name, emergency_contact, notes
                FROM RECIPIENTS
                WHERE recipient_id = ?
                """;

        List<RecipientResponse> results = jdbcTemplate.query(sql, RECIPIENT_ROW_MAPPER, recipientId);
        return results.stream().findFirst();
    }

    /**
     * 등록 페이지에서 입력한 수급자 정보를 RECIPIENTS 테이블에 저장한다.
     * 저장 후에는 생성된 PK로 다시 조회해서 화면 공통 응답 구조로 반환한다.
     */
    public RecipientResponse save(RecipientCreateRequest request) {
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
            throw new IllegalStateException("수급자 저장 후 생성된 ID를 확인할 수 없습니다.");
        }

        return findById(generatedId.longValue())
                .orElseThrow(() -> new IllegalStateException("저장된 수급자 정보를 다시 조회하지 못했습니다."));
    }

    /**
     * 수정 페이지에서 바꾼 항목만 RECIPIENTS 테이블에 반영한다.
     * 저장 후에는 상세 화면에서 같은 응답 구조를 재사용할 수 있도록 다시 조회해서 반환한다.
     */
    public RecipientResponse update(Long recipientId, RecipientUpdateRequest request) {
        String sql = """
                UPDATE RECIPIENTS
                SET birth_date = ?,
                    care_grade = ?,
                    guardian_name = ?,
                    emergency_contact = ?
                WHERE recipient_id = ?
                """;

        int updatedCount = jdbcTemplate.update(
                sql,
                Date.valueOf(request.getBirthDate()),
                request.getCareGrade(),
                request.getGuardianName(),
                request.getEmergencyContact(),
                recipientId
        );

        if (updatedCount == 0) {
            throw new IllegalArgumentException("수정할 수급자를 찾을 수 없습니다. id=" + recipientId);
        }

        return findById(recipientId)
                .orElseThrow(() -> new IllegalStateException("수정된 수급자 정보를 다시 조회하지 못했습니다."));
    }
}
