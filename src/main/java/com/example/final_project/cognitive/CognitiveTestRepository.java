package com.example.final_project.cognitive;

import com.example.final_project.cognitive.dto.CognitiveQuestionResponse;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public class CognitiveTestRepository {

    /**
     * 질문 조회 결과를 프론트 전용 응답 형태로 바로 매핑한다.
     */
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

    /**
     * QUESTION_TYPES별로 무작위 순번을 매긴 뒤
     * 각 유형마다 필요한 개수만큼만 잘라 총 검사 문항을 만든다.
     */
    public List<CognitiveQuestionResponse> findRandomQuestionsPerType(int questionsPerType) {
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
                           -- 유형별 랜덤 순서를 만들어 상위 N문항만 선택한다.
                           ROW_NUMBER() OVER (PARTITION BY q.question_type_id ORDER BY RAND()) AS question_sequence
                    FROM QUESTIONS q
                    INNER JOIN QUESTION_TYPES qt ON q.question_type_id = qt.question_type_id
                ) ranked_questions
                WHERE question_sequence <= ?
                ORDER BY question_type_id ASC, question_sequence ASC
                """;

        return jdbcTemplate.query(sql, QUESTION_ROW_MAPPER, questionsPerType);
    }
}
