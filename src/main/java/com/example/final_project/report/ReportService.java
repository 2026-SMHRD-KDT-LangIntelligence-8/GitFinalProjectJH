package com.example.final_project.report;

import com.example.final_project.analysis.AnalysisPipelineService;
import com.example.final_project.analysis.dto.QuestionTypeSummary;
import com.example.final_project.analysis.dto.ReportSummaryResult;
import com.example.final_project.recipient.RecipientRepository;
import com.example.final_project.recipient.dto.RecipientResponse;
import com.example.final_project.report.dto.PerformanceReportResponse;
import com.example.final_project.report.dto.PerformanceReportSummaryResponse;
import com.example.final_project.report.dto.QuestionTypeScoreResponse;
import com.example.final_project.report.dto.TrendPointResponse;
import com.example.final_project.report.dto.TrendReportResponse;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;
import java.util.Map;

@Service
// 리포트 화면에서 보여줄 문항별 결과와 기간별 추이를 분석 파이프라인 기준으로 조합한다.
public class ReportService {

    private final ReportRepository reportRepository;
    private final RecipientRepository recipientRepository;
    private final AnalysisPipelineService analysisPipelineService;

    public ReportService(
            ReportRepository reportRepository,
            RecipientRepository recipientRepository,
            AnalysisPipelineService analysisPipelineService
    ) {
        this.reportRepository = reportRepository;
        this.recipientRepository = recipientRepository;
        this.analysisPipelineService = analysisPipelineService;
    }

    // 수급자별로 실제 조회 가능한 수행 리포트 목록을 반환한다.
    public List<PerformanceReportSummaryResponse> getAvailableReports(Long recipientId, String userId) {
        ensureRecipientAccess(recipientId, userId);
        return reportRepository.findAvailableReports(recipientId, userId);
    }

    public List<QuestionTypeScoreResponse> getLatestQuestionTypeScores(Long recipientId, String userId) {
        ensureRecipientAccess(recipientId, userId);
        List<PerformanceReportSummaryResponse> availableReports = reportRepository.findAvailableReports(recipientId, userId);
        if (availableReports.isEmpty()) {
            return List.of();
        }

        Long latestPerformanceId = availableReports.get(0).performanceId();
        ReportSummaryResult summaryResult = analysisPipelineService.calculateReportSummary(
                reportRepository.findAnalysisRowsByPerformanceId(latestPerformanceId, recipientId, userId)
        );

        return toQuestionTypeScores(summaryResult.questionTypeSummaries());
    }

    // 한 번의 검사 결과는 분석 행 전체를 넘겨 파이썬 요약 결과로 다시 계산한다.
    public PerformanceReportResponse getPerformanceReport(Long recipientId, Long performanceId, String userId) {
        RecipientResponse recipient = ensureRecipientAccess(recipientId, userId);
        ReportSummaryResult summaryResult = analysisPipelineService.calculateReportSummary(
                reportRepository.findAnalysisRowsByPerformanceId(performanceId, recipientId, userId)
        );

        return new PerformanceReportResponse(
                recipientId,
                recipient.getRecipientName(),
                performanceId,
                reportRepository.findAvailableReports(recipientId, userId).stream()
                        .filter(summary -> summary.performanceId().equals(performanceId))
                        .map(PerformanceReportSummaryResponse::performedAt)
                        .findFirst()
                        .orElse(""),
                toQuestionTypeScores(summaryResult.questionTypeSummaries())
        );
    }

    // 기간별 추이는 날짜별 분석 행을 묶어서 일자 단위 평균 최종점수로 환산한다.
    public TrendReportResponse getTrendReport(Long recipientId, int periodDays, String userId) {
        RecipientResponse recipient = ensureRecipientAccess(recipientId, userId);
        List<TrendPointResponse> points = reportRepository.findTrendAnalysisRows(recipientId, userId, periodDays).stream()
                .collect(java.util.stream.Collectors.groupingBy(
                        ReportRepository.PerformanceAnalysisRow::performedDate,
                        java.util.LinkedHashMap::new,
                        java.util.stream.Collectors.mapping(ReportRepository.PerformanceAnalysisRow::row, java.util.stream.Collectors.toList())
                ))
                .entrySet()
                .stream()
                .map(entry -> {
                    ReportSummaryResult summaryResult = analysisPipelineService.calculateReportSummary(entry.getValue());
                    return new TrendPointResponse(
                            entry.getKey(),
                            summaryResult.avgFinalScore() == null ? 0 : summaryResult.avgFinalScore(),
                            toQuestionTypeScores(summaryResult.questionTypeSummaries())
                    );
                })
                .toList();

        return new TrendReportResponse(
                recipientId,
                recipient.getRecipientName(),
                periodDays,
                points
        );
    }

    // 문항 유형별 평균 최종점수가 60점 미만이면 훈련 필요로 표시한다.
    private List<QuestionTypeScoreResponse> toQuestionTypeScores(Map<String, QuestionTypeSummary> summaries) {
        if (summaries == null || summaries.isEmpty()) {
            return List.of();
        }

        return summaries.entrySet()
                .stream()
                .sorted(Comparator.comparing(Map.Entry::getKey))
                .map(entry -> new QuestionTypeScoreResponse(
                        null,
                        entry.getKey(),
                        entry.getValue().avgFinalScore() == null ? 0 : entry.getValue().avgFinalScore(),
                        entry.getValue().avgFinalScore() != null && entry.getValue().avgFinalScore() < 60
                ))
                .toList();
    }

    private RecipientResponse ensureRecipientAccess(Long recipientId, String userId) {
        return recipientRepository.findByIdAndUserId(recipientId, userId)
                .orElseThrow(() -> new IllegalArgumentException("해당 수급자를 찾을 수 없습니다. id=" + recipientId));
    }
}
