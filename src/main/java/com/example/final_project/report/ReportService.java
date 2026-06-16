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
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
// 리포트 화면에서 보여줄 문항별 결과와 기간별 추이를 분석 파이프라인 기준으로 조합한다.
public class ReportService {

    private final ReportRepository reportRepository;
    private final RecipientRepository recipientRepository;
    private final AnalysisPipelineService analysisPipelineService;
    private final ObjectMapper objectMapper;

    public ReportService(
            ReportRepository reportRepository,
            RecipientRepository recipientRepository,
            AnalysisPipelineService analysisPipelineService,
            ObjectMapper objectMapper
    ) {
        this.reportRepository = reportRepository;
        this.recipientRepository = recipientRepository;
        this.analysisPipelineService = analysisPipelineService;
        this.objectMapper = objectMapper;
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
        ReportSummaryResult summaryResult = calculateReportSummaryWithFallback(
                reportRepository.findAnalysisRowsByPerformanceId(latestPerformanceId, recipientId, userId)
        );

        return toQuestionTypeScores(summaryResult.questionTypeSummaries());
    }

    // 한 번의 검사 결과는 분석 행 전체를 넘겨 파이썬 요약 결과로 다시 계산한다.
    public PerformanceReportResponse getPerformanceReport(Long recipientId, Long performanceId, String userId) {
        RecipientResponse recipient = ensureRecipientAccess(recipientId, userId);
        LocalDateTime performedAt = reportRepository.findPerformedAtByPerformanceId(performanceId, recipientId, userId);
        ReportSummaryResult summaryResult = calculateReportSummaryWithFallback(
                reportRepository.findAnalysisRowsByPerformanceId(performanceId, recipientId, userId)
        );
        List<QuestionTypeScoreResponse> questionTypeScores = toQuestionTypeScores(summaryResult.questionTypeSummaries());

        savePerformanceReportSnapshot(
                recipient,
                performedAt.toLocalDate(),
                summaryResult,
                questionTypeScores,
                userId
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
                questionTypeScores
        );
    }

    // 기간별 추이는 날짜별 분석 행을 묶어서 일자 단위 평균 최종점수로 환산한다.
    public TrendReportResponse getTrendReport(Long recipientId, int periodDays, String userId) {
        RecipientResponse recipient = ensureRecipientAccess(recipientId, userId);
        List<ReportRepository.PerformanceAnalysisRow> trendRows = reportRepository.findTrendAnalysisRows(recipientId, userId, periodDays);

        List<TrendPointResponse> points = trendRows.stream()
                .collect(java.util.stream.Collectors.groupingBy(
                        ReportRepository.PerformanceAnalysisRow::performedDate,
                        java.util.LinkedHashMap::new,
                        java.util.stream.Collectors.mapping(ReportRepository.PerformanceAnalysisRow::row, java.util.stream.Collectors.toList())
                ))
                .entrySet()
                .stream()
                .map(entry -> {
                    ReportSummaryResult summaryResult = calculateReportSummaryWithFallback(entry.getValue());
                    return new TrendPointResponse(
                            entry.getKey(),
                            summaryResult.avgFinalScore() == null ? 0 : summaryResult.avgFinalScore(),
                            toQuestionTypeScores(summaryResult.questionTypeSummaries())
                    );
                })
                .toList();

        if (!trendRows.isEmpty()) {
            ReportSummaryResult trendSummaryResult = calculateReportSummaryWithFallback(
                    trendRows.stream().map(ReportRepository.PerformanceAnalysisRow::row).toList()
            );
            saveTrendReportSnapshot(recipient, periodDays, trendSummaryResult, points, userId);
        }

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

    private ReportSummaryResult calculateReportSummaryWithFallback(List<com.example.final_project.analysis.dto.ReportAnalysisRow> rows) {
        try {
            return analysisPipelineService.calculateReportSummary(rows);
        } catch (IllegalStateException exception) {
            return buildFallbackSummary(rows);
        }
    }

    private ReportSummaryResult buildFallbackSummary(List<com.example.final_project.analysis.dto.ReportAnalysisRow> rows) {
        if (rows == null || rows.isEmpty()) {
            return new ReportSummaryResult(
                    0,
                    0.0,
                    0.0,
                    0.0,
                    0.0,
                    null,
                    null,
                    null,
                    0.0,
                    Map.of(),
                    List.of()
            );
        }

        Map<String, List<com.example.final_project.analysis.dto.ReportAnalysisRow>> groupedRows = rows.stream()
                .collect(Collectors.groupingBy(
                        row -> row.questionTypeName() == null ? "기타" : row.questionTypeName(),
                        java.util.LinkedHashMap::new,
                        Collectors.toList()
                ));

        Map<String, QuestionTypeSummary> questionTypeSummaries = new HashMap<>();
        for (Map.Entry<String, List<com.example.final_project.analysis.dto.ReportAnalysisRow>> entry : groupedRows.entrySet()) {
            List<com.example.final_project.analysis.dto.ReportAnalysisRow> typeRows = entry.getValue();
            double avgResponseTime = averageDouble(typeRows, com.example.final_project.analysis.dto.ReportAnalysisRow::responseTime);
            double avgRepetitionRatio = averageDouble(typeRows, com.example.final_project.analysis.dto.ReportAnalysisRow::repetitionRatio);
            double avgSentenceLength = averageDouble(typeRows, com.example.final_project.analysis.dto.ReportAnalysisRow::avgSentenceLength);
            double avgAppropriatenessScore = averageInt(typeRows, com.example.final_project.analysis.dto.ReportAnalysisRow::appropriatenessScore);
            double avgFinalScore = avgAppropriatenessScore;

            questionTypeSummaries.put(entry.getKey(), new QuestionTypeSummary(
                    typeRows.size(),
                    roundOne(avgResponseTime),
                    roundOne(avgRepetitionRatio),
                    roundOne(avgSentenceLength),
                    roundOne(avgAppropriatenessScore),
                    null,
                    null,
                    null,
                    roundOne(avgFinalScore)
            ));
        }

        return new ReportSummaryResult(
                rows.size(),
                roundOne(averageDouble(rows, com.example.final_project.analysis.dto.ReportAnalysisRow::responseTime)),
                roundOne(averageDouble(rows, com.example.final_project.analysis.dto.ReportAnalysisRow::repetitionRatio)),
                roundOne(averageDouble(rows, com.example.final_project.analysis.dto.ReportAnalysisRow::avgSentenceLength)),
                roundOne(averageInt(rows, com.example.final_project.analysis.dto.ReportAnalysisRow::appropriatenessScore)),
                null,
                null,
                null,
                roundOne(averageInt(rows, com.example.final_project.analysis.dto.ReportAnalysisRow::appropriatenessScore)),
                questionTypeSummaries,
                List.of()
        );
    }

    private double averageDouble(
            List<com.example.final_project.analysis.dto.ReportAnalysisRow> rows,
            java.util.function.Function<com.example.final_project.analysis.dto.ReportAnalysisRow, Double> extractor
    ) {
        return rows.stream()
                .map(extractor)
                .filter(Objects::nonNull)
                .mapToDouble(Double::doubleValue)
                .average()
                .orElse(0.0);
    }

    private double averageInt(
            List<com.example.final_project.analysis.dto.ReportAnalysisRow> rows,
            java.util.function.Function<com.example.final_project.analysis.dto.ReportAnalysisRow, Integer> extractor
    ) {
        return rows.stream()
                .map(extractor)
                .filter(Objects::nonNull)
                .mapToInt(Integer::intValue)
                .average()
                .orElse(0.0);
    }

    private double roundOne(double value) {
        return Math.round(value * 10.0) / 10.0;
    }

    private void savePerformanceReportSnapshot(
            RecipientResponse recipient,
            LocalDate performedDate,
            ReportSummaryResult summaryResult,
            List<QuestionTypeScoreResponse> questionTypeScores,
            String userId
    ) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("recipientName", recipient.getRecipientName());
        payload.put("performedDate", performedDate.toString());
        payload.put("avgResponseTime", summaryResult.avgResponseTime());
        payload.put("avgRepetitionRatio", summaryResult.avgRepetitionRatio());
        payload.put("avgSentenceLength", summaryResult.avgSentenceLength());
        payload.put("avgAppropriatenessScore", summaryResult.avgAppropriatenessScore());
        payload.put("avgFinalScore", summaryResult.avgFinalScore());
        payload.put("questionTypeScores", questionTypeScores);

        reportRepository.upsertReportSnapshot(
                userId,
                recipient.getRecipientId(),
                performedDate,
                performedDate,
                summaryResult.avgResponseTime(),
                summaryResult.avgRepetitionRatio(),
                summaryResult.avgSentenceLength(),
                summaryResult.avgAppropriatenessScore(),
                null,
                toJson(payload)
        );
    }

    private void saveTrendReportSnapshot(
            RecipientResponse recipient,
            int periodDays,
            ReportSummaryResult summaryResult,
            List<TrendPointResponse> points,
            String userId
    ) {
        LocalDate periodEndDate = LocalDate.now();
        LocalDate periodStartDate = periodEndDate.minusDays(Math.max(periodDays - 1L, 0L));

        reportRepository.upsertReportSnapshot(
                userId,
                recipient.getRecipientId(),
                periodStartDate,
                periodEndDate,
                summaryResult.avgResponseTime(),
                summaryResult.avgRepetitionRatio(),
                summaryResult.avgSentenceLength(),
                summaryResult.avgAppropriatenessScore(),
                toJson(points),
                toJson(Map.of(
                        "recipientName", recipient.getRecipientName(),
                        "periodDays", periodDays,
                        "avgFinalScore", summaryResult.avgFinalScore()
                ))
        );
    }

    private String toJson(Object payload) {
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("리포트 저장용 JSON 직렬화에 실패했습니다.", exception);
        }
    }

    private RecipientResponse ensureRecipientAccess(Long recipientId, String userId) {
        return recipientRepository.findByIdAndUserId(recipientId, userId)
                .orElseThrow(() -> new IllegalArgumentException("해당 수급자를 찾을 수 없습니다. id=" + recipientId));
    }
}
