package com.example.final_project.report;

import com.example.final_project.recipient.RecipientRepository;
import com.example.final_project.recipient.dto.RecipientResponse;
import com.example.final_project.report.dto.PerformanceReportResponse;
import com.example.final_project.report.dto.PerformanceReportSummaryResponse;
import com.example.final_project.report.dto.QuestionTypeScoreResponse;
import com.example.final_project.report.dto.TrendPointResponse;
import com.example.final_project.report.dto.TrendReportResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class ReportService {

    private static final Logger log = LoggerFactory.getLogger(ReportService.class);

    private final ReportRepository reportRepository;
    private final RecipientRepository recipientRepository;

    public ReportService(
            ReportRepository reportRepository,
            RecipientRepository recipientRepository
    ) {
        this.reportRepository = reportRepository;
        this.recipientRepository = recipientRepository;
    }

    public List<PerformanceReportSummaryResponse> getAvailableReports(Long recipientId, String userId) {
        ensureRecipientAccess(recipientId, userId);
        return reportRepository.findAvailableReports(recipientId, userId);
    }

    public List<QuestionTypeScoreResponse> getLatestQuestionTypeScores(Long recipientId, String userId) {
        ensureRecipientAccess(recipientId, userId);
        List<PerformanceReportSummaryResponse> reports = reportRepository.findAvailableReports(recipientId, userId);

        if (reports.isEmpty()) {
            return List.of();
        }

        return reportRepository.findScoresByPerformanceId(reports.get(0).performanceId(), recipientId, userId);
    }

    public PerformanceReportResponse getPerformanceReport(Long recipientId, Long performanceId, String userId) {
        RecipientResponse recipient = ensureRecipientAccess(recipientId, userId);
        List<QuestionTypeScoreResponse> questionTypeScores =
                reportRepository.findScoresByPerformanceId(performanceId, recipientId, userId);

        LocalDateTime performedAt = reportRepository.findPerformedAtByPerformanceId(performanceId, recipientId, userId);
        String performedAtLabel = resolvePerformedAtLabel(recipientId, performanceId, userId, performedAt);

        persistPerformanceSnapshotSafely(
                recipient,
                performedAt.toLocalDate(),
                questionTypeScores,
                userId
        );

        return new PerformanceReportResponse(
                recipientId,
                recipient.getRecipientName(),
                performanceId,
                performedAtLabel,
                questionTypeScores
        );
    }

    public TrendReportResponse getTrendReport(Long recipientId, int periodDays, String userId) {
        RecipientResponse recipient = ensureRecipientAccess(recipientId, userId);
        List<TrendPointResponse> points = reportRepository.findTrendPoints(recipientId, userId, periodDays);

        persistTrendSnapshotSafely(recipient, periodDays, points, userId);

        return new TrendReportResponse(
                recipientId,
                recipient.getRecipientName(),
                periodDays,
                points
        );
    }

    private String resolvePerformedAtLabel(
            Long recipientId,
            Long performanceId,
            String userId,
            LocalDateTime fallback
    ) {
        return reportRepository.findAvailableReports(recipientId, userId).stream()
                .filter(report -> report.performanceId().equals(performanceId))
                .map(PerformanceReportSummaryResponse::performedAt)
                .findFirst()
                .orElse(fallback.toLocalDate().toString());
    }

    private void persistPerformanceSnapshotSafely(
            RecipientResponse recipient,
            LocalDate performedDate,
            List<QuestionTypeScoreResponse> questionTypeScores,
            String userId
    ) {
        try {
            double averageScore = questionTypeScores.stream()
                    .mapToDouble(QuestionTypeScoreResponse::averageScore)
                    .average()
                    .orElse(0.0);

            reportRepository.upsertReportSnapshot(
                    userId,
                    recipient.getRecipientId(),
                    performedDate,
                    performedDate,
                    null,
                    null,
                    null,
                    averageScore,
                    null,
                    buildPerformanceSummaryText(recipient.getRecipientName(), performedDate, questionTypeScores)
            );
        } catch (RuntimeException exception) {
            log.warn(
                    "Failed to persist performance snapshot. recipientId={}, performedDate={}",
                    recipient.getRecipientId(),
                    performedDate,
                    exception
            );
        }
    }

    private void persistTrendSnapshotSafely(
            RecipientResponse recipient,
            int periodDays,
            List<TrendPointResponse> points,
            String userId
    ) {
        if (points.isEmpty()) {
            return;
        }

        LocalDate periodEndDate = LocalDate.now();
        LocalDate periodStartDate = periodEndDate.minusDays(Math.max(periodDays - 1L, 0L));

        try {
            double averageScore = points.stream()
                    .mapToDouble(TrendPointResponse::averageScore)
                    .average()
                    .orElse(0.0);

            reportRepository.upsertReportSnapshot(
                    userId,
                    recipient.getRecipientId(),
                    periodStartDate,
                    periodEndDate,
                    null,
                    null,
                    null,
                    averageScore,
                    buildTrendSummaryText(periodDays, points),
                    buildTrendReportSummaryText(recipient.getRecipientName(), periodDays, averageScore)
            );
        } catch (RuntimeException exception) {
            log.warn(
                    "Failed to persist trend snapshot. recipientId={}, periodDays={}",
                    recipient.getRecipientId(),
                    periodDays,
                    exception
            );
        }
    }

    private String buildPerformanceSummaryText(
            String recipientName,
            LocalDate performedDate,
            List<QuestionTypeScoreResponse> questionTypeScores
    ) {
        String scoreSummary = questionTypeScores.stream()
                .map(score -> score.questionTypeName() + " " + formatScore(score.averageScore()) + "점")
                .reduce((left, right) -> left + ", " + right)
                .orElse("문항 점수 없음");

        return recipientName + " / " + performedDate + " / " + scoreSummary;
    }

    private String buildTrendSummaryText(int periodDays, List<TrendPointResponse> points) {
        String pointSummary = points.stream()
                .map(point -> point.performedDate() + ":" + formatScore(point.averageScore()) + "점")
                .reduce((left, right) -> left + ", " + right)
                .orElse("추이 데이터 없음");

        return "최근 " + periodDays + "일 추이 / " + pointSummary;
    }

    private String buildTrendReportSummaryText(String recipientName, int periodDays, double averageScore) {
        return recipientName + " / 최근 " + periodDays + "일 / 평균 " + formatScore(averageScore) + "점";
    }

    private String formatScore(double value) {
        return value == Math.rint(value)
                ? Integer.toString((int) value)
                : String.format(java.util.Locale.ROOT, "%.1f", value);
    }

    private RecipientResponse ensureRecipientAccess(Long recipientId, String userId) {
        return recipientRepository.findByIdAndUserId(recipientId, userId)
                .orElseThrow(() -> new IllegalArgumentException("해당 수급자를 찾을 수 없습니다. id=" + recipientId));
    }
}
