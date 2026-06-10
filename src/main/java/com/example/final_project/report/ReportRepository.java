package com.example.final_project.report;

import com.example.final_project.report.dto.PerformanceReportSummaryResponse;
import com.example.final_project.report.dto.QuestionTypeScoreResponse;
import com.example.final_project.report.dto.TrendPointResponse;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public class ReportRepository {

    private final JdbcTemplate jdbcTemplate;

    public ReportRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<PerformanceReportSummaryResponse> findAvailableReports(Long recipientId, String userId) {
        String sql = """
                SELECT pr.performance_id,
                       DATE_FORMAT(pr.performed_at, '%Y-%m-%d %H:%i') AS performed_at
                FROM PERFORMANCE_RECORDS pr
                WHERE pr.recipient_id = ?
                  AND pr.user_id = ?
                  AND EXISTS (
                      SELECT 1
                      FROM QUESTION_RESULTS qr
                      INNER JOIN ANALYSIS_RESULTS ar ON qr.question_result_id = ar.question_result_id
                      WHERE qr.performance_id = pr.performance_id
                  )
                ORDER BY pr.performed_at DESC
                """;

        return jdbcTemplate.query(
                sql,
                (rs, rowNum) -> new PerformanceReportSummaryResponse(
                        rs.getLong("performance_id"),
                        rs.getString("performed_at")
                ),
                recipientId,
                userId
        );
    }

    public List<QuestionTypeScoreResponse> findScoresByPerformanceId(Long performanceId, Long recipientId, String userId) {
        String sql = """
                SELECT qt.question_type_name,
                       ROUND(AVG(ar.appropriateness_score), 1) AS average_score
                FROM PERFORMANCE_RECORDS pr
                INNER JOIN QUESTION_RESULTS qr ON pr.performance_id = qr.performance_id
                INNER JOIN ANALYSIS_RESULTS ar ON qr.question_result_id = ar.question_result_id
                INNER JOIN QUESTIONS q ON qr.question_id = q.question_id
                INNER JOIN QUESTION_TYPES qt ON q.question_type_id = qt.question_type_id
                WHERE pr.performance_id = ?
                  AND pr.recipient_id = ?
                  AND pr.user_id = ?
                GROUP BY q.question_type_id, qt.question_type_name
                ORDER BY q.question_type_id ASC
                """;

        return jdbcTemplate.query(
                sql,
                (rs, rowNum) -> new QuestionTypeScoreResponse(
                        rs.getString("question_type_name"),
                        rs.getDouble("average_score"),
                        rs.getDouble("average_score") < 60
                ),
                performanceId,
                recipientId,
                userId
        );
    }

    public List<TrendPointResponse> findTrendPoints(Long recipientId, String userId, int periodDays) {
        LocalDateTime fromDateTime = LocalDateTime.now().minusDays(periodDays);

        String sql = """
                SELECT DATE_FORMAT(pr.performed_at, '%Y-%m-%d') AS performed_date,
                       ROUND(AVG(ar.appropriateness_score), 1) AS average_score
                FROM PERFORMANCE_RECORDS pr
                INNER JOIN QUESTION_RESULTS qr ON pr.performance_id = qr.performance_id
                INNER JOIN ANALYSIS_RESULTS ar ON qr.question_result_id = ar.question_result_id
                WHERE pr.recipient_id = ?
                  AND pr.user_id = ?
                  AND pr.performed_at >= ?
                GROUP BY DATE(pr.performed_at)
                ORDER BY DATE(pr.performed_at) ASC
                """;

        return jdbcTemplate.query(
                sql,
                (rs, rowNum) -> new TrendPointResponse(
                        rs.getString("performed_date"),
                        rs.getDouble("average_score")
                ),
                recipientId,
                userId,
                Timestamp.valueOf(fromDateTime)
        );
    }
}
