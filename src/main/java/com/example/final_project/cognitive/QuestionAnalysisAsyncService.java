package com.example.final_project.cognitive;

import com.example.final_project.analysis.AnalysisPipelineService;
import com.example.final_project.analysis.dto.QuestionAnalysisResult;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.nio.file.Path;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

@Service
public class QuestionAnalysisAsyncService {

    private static final Logger log = LoggerFactory.getLogger(QuestionAnalysisAsyncService.class);

    private final AnalysisPipelineService analysisPipelineService;
    private final CognitiveTestRepository cognitiveTestRepository;
    private final ExecutorService executorService = Executors.newFixedThreadPool(2);
    private final ConcurrentMap<Long, AnalysisSnapshot> snapshots = new ConcurrentHashMap<>();

    public QuestionAnalysisAsyncService(
            AnalysisPipelineService analysisPipelineService,
            CognitiveTestRepository cognitiveTestRepository
    ) {
        this.analysisPipelineService = analysisPipelineService;
        this.cognitiveTestRepository = cognitiveTestRepository;
    }

    public void queueAnalysis(
            Long questionResultId,
            Path audioPath,
            String questionTypeName,
            String questionText,
            String imageDescription
    ) {
        snapshots.put(
                questionResultId,
                new AnalysisSnapshot("QUEUED", "음성 파일 저장이 완료되어 분석 대기 중입니다.", null, null, null)
        );

        CompletableFuture.runAsync(
                () -> analyze(questionResultId, audioPath, questionTypeName, questionText, imageDescription),
                executorService
        );
    }

    public AnalysisSnapshot getSnapshot(Long questionResultId) {
        return snapshots.get(questionResultId);
    }

    private void analyze(
            Long questionResultId,
            Path audioPath,
            String questionTypeName,
            String questionText,
            String imageDescription
    ) {
        snapshots.put(
                questionResultId,
                new AnalysisSnapshot("RUNNING", "음성 데이터를 텍스트로 변환하고 있습니다.", null, null, null)
        );

        try {
            QuestionAnalysisResult analysisResult = analysisPipelineService.analyzeQuestionAnswer(
                    audioPath,
                    questionTypeName,
                    questionText,
                    imageDescription
            );

            if (isBlank(analysisResult.sttText())) {
                FailureInfo failureInfo = new FailureInfo(
                        "LOW_VOLUME_OR_SILENCE",
                        "음성이 너무 작거나 무음으로 감지되어 텍스트 변환 결과를 만들지 못했습니다."
                );
                log.warn(
                        "Question analysis produced blank STT. questionResultId={}, audioPath={}, questionTypeName={}",
                        questionResultId,
                        audioPath,
                        questionTypeName
                );
                snapshots.put(
                        questionResultId,
                        new AnalysisSnapshot("FAILED", failureInfo.message(), failureInfo.code(), failureInfo.message(), null)
                );
                return;
            }

            cognitiveTestRepository.updateQuestionResultTexts(
                    questionResultId,
                    analysisResult.sttText()
            );
            cognitiveTestRepository.saveAnalysisResult(
                    questionResultId,
                    analysisResult.preprocessedText(),
                    analysisResult.responseTime(),
                    analysisResult.repetitionRatio(),
                    analysisResult.avgSentenceLength(),
                    analysisResult.appropriatenessScore()
            );

            snapshots.put(
                    questionResultId,
                    new AnalysisSnapshot("COMPLETED", "음성 분석이 완료되었습니다.", null, null, analysisResult)
            );
        } catch (Exception exception) {
            FailureInfo failureInfo = classifyFailure(exception);
            log.error(
                    "Question analysis failed. questionResultId={}, audioPath={}, questionTypeName={}, failureCode={}",
                    questionResultId,
                    audioPath,
                    questionTypeName,
                    failureInfo.code(),
                    exception
            );
            snapshots.put(
                    questionResultId,
                    new AnalysisSnapshot("FAILED", failureInfo.message(), failureInfo.code(), failureInfo.message(), null)
            );
        }
    }

    private FailureInfo classifyFailure(Exception exception) {
        String message = Objects.toString(exception.getMessage(), "");

        if (message.startsWith("ANALYSIS_SERVER_UNAVAILABLE:")) {
            return new FailureInfo(
                    "ANALYSIS_SERVER_UNAVAILABLE",
                    "음성 분석 서버와 통신하지 못했습니다. 잠시 후 다시 확인해주세요."
            );
        }

        return new FailureInfo(
                "ANALYSIS_PROCESSING_FAILED",
                "음성 파일 분석 중 문제가 발생했습니다. 다시 검사해 주세요."
        );
    }

    private boolean isBlank(String value) {
        return Objects.toString(value, "").trim().isEmpty();
    }

    @PreDestroy
    void shutdown() {
        executorService.shutdown();
        try {
            if (!executorService.awaitTermination(5, TimeUnit.SECONDS)) {
                executorService.shutdownNow();
            }
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            executorService.shutdownNow();
        }
    }

    private record FailureInfo(
            String code,
            String message
    ) {
    }

    public record AnalysisSnapshot(
            String status,
            String message,
            String failureCode,
            String failureDetail,
            QuestionAnalysisResult result
    ) {
    }
}
