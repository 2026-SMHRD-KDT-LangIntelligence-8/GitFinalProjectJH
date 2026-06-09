package com.example.final_project.report;

import com.example.final_project.recipient.RecipientRepository;
import com.example.final_project.recipient.dto.RecipientResponse;
import com.example.final_project.report.dto.PerformanceReportResponse;
import com.example.final_project.report.dto.PerformanceReportSummaryResponse;
import com.example.final_project.report.dto.TrendPointResponse;
import com.example.final_project.report.dto.TrendReportResponse;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ReportService {

    private final ReportRepository reportRepository;
    private final RecipientRepository recipientRepository;

    public ReportService(ReportRepository reportRepository, RecipientRepository recipientRepository) {
        this.reportRepository = reportRepository;
        this.recipientRepository = recipientRepository;
    }

    public List<PerformanceReportSummaryResponse> getAvailableReports(Long recipientId, String userId) {
        ensureRecipientAccess(recipientId, userId);
        return reportRepository.findAvailableReports(recipientId, userId);
    }

    public PerformanceReportResponse getPerformanceReport(Long recipientId, Long performanceId, String userId) {
        RecipientResponse recipient = ensureRecipientAccess(recipientId, userId);

        return new PerformanceReportResponse(
                recipientId,
                recipient.getRecipientName(),
                performanceId,
                reportRepository.findAvailableReports(recipientId, userId).stream()
                        .filter(summary -> summary.performanceId().equals(performanceId))
                        .map(PerformanceReportSummaryResponse::performedAt)
                        .findFirst()
                        .orElse(""),
                reportRepository.findScoresByPerformanceId(performanceId, recipientId, userId)
        );
    }

    public TrendReportResponse getTrendReport(Long recipientId, int periodDays, String userId) {
        RecipientResponse recipient = ensureRecipientAccess(recipientId, userId);
        List<TrendPointResponse> points = reportRepository.findTrendPoints(recipientId, userId, periodDays);

        return new TrendReportResponse(
                recipientId,
                recipient.getRecipientName(),
                periodDays,
                points
        );
    }

    private RecipientResponse ensureRecipientAccess(Long recipientId, String userId) {
        return recipientRepository.findByIdAndUserId(recipientId, userId)
                .orElseThrow(() -> new IllegalArgumentException("해당 수급자를 찾을 수 없습니다. id=" + recipientId));
    }
}
