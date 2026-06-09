package com.example.final_project.cognitive;

import com.example.final_project.cognitive.dto.CognitiveQuestionResponse;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

import java.sql.PreparedStatement;
import java.sql.Statement;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public class CognitiveTestRepository {

    private static final RowMapper<CognitiveQuestionResponse> QUESTION_ROW_MAPPER = (rs, rowNum) ->
            new CognitiveQuestionResponse(
                    rs.getLong("question_id"),
                    rs.getLong("question_type_id"),
                    rs.getString("question_type_name"),
                    rs.getString("question_text"),
                    rs.getString("question_purpose"),
                    rs.getString("image_file_path"),
                    rs.getString("image_description_criteria"),
                    rs.getInt("question_sequence")
            );

    private final JdbcTemplate jdbcTemplate;

    public CognitiveTestRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<CognitiveQuestionResponse> findRandomQuestionsPerType(int questionsPerType, String questionPurpose) {
        String sql = """
                SELECT question_id,
                       question_type_id,
                       question_type_name,
                       question_text,
                       question_purpose,
                       image_file_path,
                       image_description_criteria,
                       question_sequence
                FROM (
                    SELECT q.question_id,
                           q.question_type_id,
                           qt.question_type_name,
                           q.question_text,
                           q.question_purpose,
                           q.image_file_path,
                           q.image_description_criteria,
                           ROW_NUMBER() OVER (PARTITION BY q.question_type_id ORDER BY RAND()) AS question_sequence
                    FROM QUESTIONS q
                    INNER JOIN QUESTION_TYPES qt ON q.question_type_id = qt.question_type_id
                    WHERE q.question_purpose = ?
                ) ranked_questions
                WHERE question_sequence <= ?
                ORDER BY question_type_id ASC, question_sequence ASC
                """;

        return jdbcTemplate.query(sql, QUESTION_ROW_MAPPER, questionPurpose, questionsPerType);
    }

    public Long createPerformanceRecord(Long recipientId, String userId) {
        KeyHolder keyHolder = new GeneratedKeyHolder();

        jdbcTemplate.update(connection -> {
            PreparedStatement statement = connection.prepareStatement(
                    """
                    INSERT INTO PERFORMANCE_RECORDS (user_id, recipient_id, performed_at)
                    VALUES (?, ?, NOW())
                    """,
                    Statement.RETURN_GENERATED_KEYS
            );
            statement.setString(1, userId);
            statement.setLong(2, recipientId);
            return statement;
        }, keyHolder);

        Number key = keyHolder.getKey();
        if (key == null) {
            throw new IllegalStateException("performance_id 생성에 실패했습니다.");
        }

        return key.longValue();
    }

    public QuestionAudioContext findQuestionAudioContext(Long performanceId, Long questionId, String userId) {
        String sql = """
                SELECT pr.performance_id,
                       pr.recipient_id,
                       pr.performed_at,
                       r.recipient_name,
                       q.question_id,
                       qt.question_type_name
                FROM PERFORMANCE_RECORDS pr
                INNER JOIN RECIPIENTS r ON pr.recipient_id = r.recipient_id
                INNER JOIN QUESTIONS q ON q.question_id = ?
                INNER JOIN QUESTION_TYPES qt ON q.question_type_id = qt.question_type_id
                WHERE pr.performance_id = ?
                  AND pr.user_id = ?
                """;

        List<QuestionAudioContext> results = jdbcTemplate.query(
                sql,
                (rs, rowNum) -> new QuestionAudioContext(
                        rs.getLong("performance_id"),
                        rs.getLong("recipient_id"),
                        rs.getString("recipient_name"),
                        rs.getLong("question_id"),
                        rs.getString("question_type_name"),
                        rs.getTimestamp("performed_at").toLocalDateTime()
                ),
                questionId,
                performanceId,
                userId
        );

        if (results.isEmpty()) {
            throw new IllegalArgumentException("음성 저장 대상 문항을 찾을 수 없습니다.");
        }

        return results.get(0);
    }

    public Long createQuestionResult(Long performanceId, Long questionId, String voiceFilePath) {
        KeyHolder keyHolder = new GeneratedKeyHolder();

        jdbcTemplate.update(connection -> {
            PreparedStatement statement = connection.prepareStatement(
                    """
                    INSERT INTO QUESTION_RESULTS (performance_id, question_id, voice_file_path)
                    VALUES (?, ?, ?)
                    """,
                    Statement.RETURN_GENERATED_KEYS
            );
            statement.setLong(1, performanceId);
            statement.setLong(2, questionId);
            statement.setString(3, voiceFilePath);
            return statement;
        }, keyHolder);

        Number key = keyHolder.getKey();
        if (key == null) {
            throw new IllegalStateException("question_result_id 생성에 실패했습니다.");
        }

        return key.longValue();
    }

    public record QuestionAudioContext(
            Long performanceId,
            Long recipientId,
            String recipientName,
            Long questionId,
            String questionTypeName,
            LocalDateTime performedAt
    ) {
    }
}
