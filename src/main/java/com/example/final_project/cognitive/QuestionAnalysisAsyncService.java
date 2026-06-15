package com.example.final_project.cognitive;

import com.example.final_project.analysis.AnalysisPipelineService;
import com.example.final_project.analysis.dto.QuestionAnalysisResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import jakarta.annotation.PreDestroy;
import java.nio.file.Path;
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
                new AnalysisSnapshot("QUEUED", "음성 저장이 완료되어 분석을 대기 중입니다.", null)
        );

        CompletableFuture.runAsync(() -> analyze(questionResultId, audioPath, questionTypeName, questionText, imageDescription), executorService);
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
                new AnalysisSnapshot("RUNNING", "음성을 텍스트로 변환하고 있습니다.", null)
        );

        try {
            QuestionAnalysisResult analysisResult = analysisPipelineService.analyzeQuestionAnswer(
                    audioPath,
                    questionTypeName,
                    questionText,
                    imageDescription
            );

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
                    new AnalysisSnapshot("COMPLETED", "음성 분석이 완료되었습니다.", analysisResult)
            );
        } catch (Exception exception) {
            log.error("문항 음성 분석에 실패했습니다. questionResultId={}", questionResultId, exception);
            snapshots.put(
                    questionResultId,
                    new AnalysisSnapshot("FAILED", exception.getMessage(), null)
            );
        }
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

    public record AnalysisSnapshot(
            String status,
            String message,
            QuestionAnalysisResult result
    ) {
    }
}
