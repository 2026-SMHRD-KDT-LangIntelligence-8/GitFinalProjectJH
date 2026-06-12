package com.example.final_project.report;

import com.example.final_project.analysis.dto.ReportAnalysisRow;
import com.example.final_project.report.dto.PerformanceReportSummaryResponse;
import com.example.final_project.report.dto.QuestionTypeScoreResponse;
import com.example.final_project.report.dto.TrendPointResponse;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.List;

@Repository
// 리포트 화면에 필요한 수행 이력과 분석 행 데이터를 조회한다.
public class ReportRepository {

    private final JdbcTemplate jdbcTemplate;

    public ReportRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    // 분석 결과가 실제로 존재하는 수행 기록만 리포트 목록으로 노출한다.
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

    // 기존 평균 점수 조회는 호환성을 위해 남겨두고, 화면 표시용 단순 점수 계산에 사용한다.
    public List<QuestionTypeScoreResponse> findScoresByPerformanceId(Long performanceId, Long recipientId, String userId) {
        String sql = """
                SELECT q.question_type_id,
                       qt.question_type_name,
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
                        rs.getLong("question_type_id"),
                        rs.getString("question_type_name"),
                        rs.getDouble("average_score"),
                        rs.getDouble("average_score") < 60
                ),
                performanceId,
                recipientId,
                userId
        );
    }

    // 새 리포트 요약 계산은 문항별 분석 원본값을 파이썬 파이프라인으로 넘기기 위해 이 행 목록을 사용한다.
    public List<ReportAnalysisRow> findAnalysisRowsByPerformanceId(Long performanceId, Long recipientId, String userId) {
        String sql = """
                SELECT qt.question_type_name,
                       ar.response_time,
                       ar.repetition_ratio,
                       ar.avg_sentence_length,
                       ar.appropriateness_score
                FROM PERFORMANCE_RECORDS pr
                INNER JOIN QUESTION_RESULTS qr ON pr.performance_id = qr.performance_id
                INNER JOIN ANALYSIS_RESULTS ar ON qr.question_result_id = ar.question_result_id
                INNER JOIN QUESTIONS q ON qr.question_id = q.question_id
                INNER JOIN QUESTION_TYPES qt ON q.question_type_id = qt.question_type_id
                WHERE pr.performance_id = ?
                  AND pr.recipient_id = ?
                  AND pr.user_id = ?
                ORDER BY q.question_type_id ASC, qr.question_result_id ASC
                """;

        return jdbcTemplate.query(
                sql,
                (rs, rowNum) -> new ReportAnalysisRow(
                        rs.getString("question_type_name"),
                        getNullableDouble(rs, "response_time"),
                        getNullableDouble(rs, "repetition_ratio"),
                        getNullableDouble(rs, "avg_sentence_length"),
                        getNullableInteger(rs, "appropriateness_score")
                ),
                performanceId,
                recipientId,
                userId
        );
    }

    // 예전 단순 추이 조회 방식도 남겨 두었지만, 현재 메인 추이는 아래 분석 행 기반 메서드를 사용한다.
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

    // 기간별 변화 추이는 날짜별 분석 행을 모아 서비스 계층에서 다시 요약 계산한다.
    public List<PerformanceAnalysisRow> findTrendAnalysisRows(Long recipientId, String userId, int periodDays) {
        LocalDateTime fromDateTime = LocalDateTime.now().minusDays(periodDays);

        String sql = """
                SELECT DATE_FORMAT(pr.performed_at, '%Y-%m-%d') AS performed_date,
                       qt.question_type_name,
                       ar.response_time,
                       ar.repetition_ratio,
                       ar.avg_sentence_length,
                       ar.appropriateness_score
                FROM PERFORMANCE_RECORDS pr
                INNER JOIN QUESTION_RESULTS qr ON pr.performance_id = qr.performance_id
                INNER JOIN ANALYSIS_RESULTS ar ON qr.question_result_id = ar.question_result_id
                INNER JOIN QUESTIONS q ON qr.question_id = q.question_id
                INNER JOIN QUESTION_TYPES qt ON q.question_type_id = qt.question_type_id
                WHERE pr.recipient_id = ?
                  AND pr.user_id = ?
                  AND pr.performed_at >= ?
                ORDER BY DATE(pr.performed_at) ASC, q.question_type_id ASC, qr.question_result_id ASC
                """;

        return jdbcTemplate.query(
                sql,
                (rs, rowNum) -> new PerformanceAnalysisRow(
                        rs.getString("performed_date"),
                        new ReportAnalysisRow(
                                rs.getString("question_type_name"),
                                getNullableDouble(rs, "response_time"),
                                getNullableDouble(rs, "repetition_ratio"),
                                getNullableDouble(rs, "avg_sentence_length"),
                                getNullableInteger(rs, "appropriateness_score")
                        )
                ),
                recipientId,
                userId,
                Timestamp.valueOf(fromDateTime)
        );
    }

    private Double getNullableDouble(java.sql.ResultSet resultSet, String column) throws java.sql.SQLException {
        double value = resultSet.getDouble(column);
        return resultSet.wasNull() ? null : value;
    }

    private Integer getNullableInteger(java.sql.ResultSet resultSet, String column) throws java.sql.SQLException {
        int value = resultSet.getInt(column);
        return resultSet.wasNull() ? null : value;
    }

    public record PerformanceAnalysisRow(
            String performedDate,
            ReportAnalysisRow row
    ) {
    }
}
