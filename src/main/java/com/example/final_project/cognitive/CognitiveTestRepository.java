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
// 검사와 훈련 진행 중 생성되는 수행기록, 문항 결과, 분석 결과를 DB에 저장한다.
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

    // 검사 또는 훈련 세션이 시작될 때 PERFORMANCE_RECORDS에 1건을 먼저 만든다.
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

    // 업로드된 음성을 어떤 수급자와 문항에 연결할지 확인하기 위한 조회다.
    public QuestionAudioContext findQuestionAudioContext(Long performanceId, Long questionId, String userId) {
        String sql = """
                SELECT pr.performance_id,
                       pr.recipient_id,
                       pr.performed_at,
                       r.recipient_name,
                       q.question_id,
                       qt.question_type_name,
                       q.question_text,
                       q.image_description_criteria
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
                        rs.getString("question_text"),
                        rs.getString("image_description_criteria"),
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

    // 원본 음성 파일 저장 경로를 QUESTION_RESULTS에 먼저 기록한다.
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

    // STT 원문과 전처리 문장을 같은 문항 결과에 덮어쓴다.
    public void updateQuestionResultTexts(Long questionResultId, String sttText) {
        jdbcTemplate.update(
                """
                UPDATE QUESTION_RESULTS
                SET stt_text = ?
                WHERE question_result_id = ?
                """,
                sttText,
                questionResultId
        );
    }

    // 문항별 분석 결과는 재업로드 상황을 고려해 있으면 수정하고 없으면 새로 저장한다.
    public void saveAnalysisResult(
            Long questionResultId,
            String preprocessedText,
            Double responseTime,
            Double repetitionRatio,
            Double avgSentenceLength,
            Integer appropriatenessScore
    ) {
        Integer existingCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM ANALYSIS_RESULTS WHERE question_result_id = ?",
                Integer.class,
                questionResultId
        );

        if (existingCount != null && existingCount > 0) {
            jdbcTemplate.update(
                    """
                    UPDATE ANALYSIS_RESULTS
                    SET preprocessed_text = ?,
                        response_time = ?,
                        repetition_ratio = ?,
                        avg_sentence_length = ?,
                        appropriateness_score = ?,
                        analyzed_at = NOW()
                    WHERE question_result_id = ?
                    """,
                    preprocessedText,
                    responseTime,
                    repetitionRatio,
                    avgSentenceLength,
                    appropriatenessScore,
                    questionResultId
            );
            return;
        }

        jdbcTemplate.update(
                """
                INSERT INTO ANALYSIS_RESULTS (
                    question_result_id,
                    preprocessed_text,
                    response_time,
                    repetition_ratio,
                    avg_sentence_length,
                    appropriateness_score,
                    analyzed_at
                ) VALUES (?, ?, ?, ?, ?, ?, NOW())
                """,
                questionResultId,
                preprocessedText,
                responseTime,
                repetitionRatio,
                avgSentenceLength,
                appropriatenessScore
        );
    }

    public QuestionResultSnapshot findQuestionResultSnapshot(Long questionResultId, String userId) {
        String sql = """
                SELECT qr.question_result_id,
                       qr.performance_id,
                       qr.question_id,
                       qr.voice_file_path,
                       qr.stt_text,
                       ar.preprocessed_text,
                       ar.appropriateness_score
                FROM QUESTION_RESULTS qr
                INNER JOIN PERFORMANCE_RECORDS pr ON pr.performance_id = qr.performance_id
                LEFT JOIN ANALYSIS_RESULTS ar ON ar.question_result_id = qr.question_result_id
                WHERE qr.question_result_id = ?
                  AND pr.user_id = ?
                """;

        List<QuestionResultSnapshot> results = jdbcTemplate.query(
                sql,
                (rs, rowNum) -> new QuestionResultSnapshot(
                        rs.getLong("question_result_id"),
                        rs.getLong("performance_id"),
                        rs.getLong("question_id"),
                        rs.getString("voice_file_path"),
                        rs.getString("stt_text"),
                        rs.getString("preprocessed_text"),
                        (Integer) rs.getObject("appropriateness_score")
                ),
                questionResultId,
                userId
        );

        if (results.isEmpty()) {
            throw new IllegalArgumentException("문항 결과를 찾을 수 없습니다. questionResultId=" + questionResultId);
        }

        return results.get(0);
    }

    public List<QuestionResultSnapshot> findQuestionResultSnapshotsByPerformanceId(Long performanceId, String userId) {
        String sql = """
                SELECT qr.question_result_id,
                       qr.performance_id,
                       qr.question_id,
                       qr.voice_file_path,
                       qr.stt_text,
                       ar.preprocessed_text,
                       ar.appropriateness_score
                FROM QUESTION_RESULTS qr
                INNER JOIN PERFORMANCE_RECORDS pr ON pr.performance_id = qr.performance_id
                LEFT JOIN ANALYSIS_RESULTS ar ON ar.question_result_id = qr.question_result_id
                WHERE qr.performance_id = ?
                  AND pr.user_id = ?
                ORDER BY qr.question_result_id ASC
                """;

        return jdbcTemplate.query(
                sql,
                (rs, rowNum) -> new QuestionResultSnapshot(
                        rs.getLong("question_result_id"),
                        rs.getLong("performance_id"),
                        rs.getLong("question_id"),
                        rs.getString("voice_file_path"),
                        rs.getString("stt_text"),
                        rs.getString("preprocessed_text"),
                        (Integer) rs.getObject("appropriateness_score")
                ),
                performanceId,
                userId
        );
    }

    public List<ReprocessTarget> findNullAnalysisTargetsByPerformanceId(Long performanceId, String userId) {
        String sql = """
                SELECT qr.question_result_id,
                       qr.performance_id,
                       qr.question_id,
                       qr.voice_file_path,
                       qt.question_type_name,
                       q.question_text,
                       q.image_description_criteria
                FROM QUESTION_RESULTS qr
                INNER JOIN PERFORMANCE_RECORDS pr ON pr.performance_id = qr.performance_id
                INNER JOIN QUESTIONS q ON q.question_id = qr.question_id
                INNER JOIN QUESTION_TYPES qt ON qt.question_type_id = q.question_type_id
                WHERE qr.performance_id = ?
                  AND pr.user_id = ?
                  AND qr.voice_file_path IS NOT NULL
                  AND (qr.stt_text IS NULL OR TRIM(qr.stt_text) = '')
                ORDER BY qr.question_result_id ASC
                """;

        return jdbcTemplate.query(
                sql,
                (rs, rowNum) -> new ReprocessTarget(
                        rs.getLong("question_result_id"),
                        rs.getLong("performance_id"),
                        rs.getLong("question_id"),
                        rs.getString("voice_file_path"),
                        rs.getString("question_type_name"),
                        rs.getString("question_text"),
                        rs.getString("image_description_criteria")
                ),
                performanceId,
                userId
        );
    }

    public record QuestionAudioContext(
            Long performanceId,
            Long recipientId,
            String recipientName,
            Long questionId,
            String questionTypeName,
            String questionText,
            String imageDescriptionCriteria,
            LocalDateTime performedAt
    ) {
    }

    public record QuestionResultSnapshot(
            Long questionResultId,
            Long performanceId,
            Long questionId,
            String voiceFilePath,
            String sttText,
            String preprocessedText,
            Integer appropriatenessScore
    ) {
    }

    public record ReprocessTarget(
            Long questionResultId,
            Long performanceId,
            Long questionId,
            String voiceFilePath,
            String questionTypeName,
            String questionText,
            String imageDescriptionCriteria
    ) {
    }
}
