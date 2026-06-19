package com.example.final_project.analysis;

import com.example.final_project.analysis.dto.QuestionAnalysisResult;
import com.example.final_project.analysis.dto.ReportAnalysisRow;
import com.example.final_project.analysis.dto.ReportSummaryResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.nio.file.Path;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
// Java backend calls a long-running FastAPI speech-analysis server over HTTP.
// This avoids reloading the Whisper model for every single question analysis.
public class AnalysisPipelineService {

    private static final Logger log = LoggerFactory.getLogger(AnalysisPipelineService.class);

    private final RestClient restClient;
    private final boolean useLlmScoring;

    public AnalysisPipelineService(
            @Value("${app.speech-analysis.base-url:http://localhost:8000}") String baseUrl,
            @Value("${app.speech-analysis.connect-timeout-ms:5000}") int connectTimeoutMs,
            @Value("${app.speech-analysis.read-timeout-ms:60000}") int readTimeoutMs,
            @Value("${app.speech-analysis.use-llm-scoring:true}") boolean useLlmScoring
    ) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofMillis(connectTimeoutMs));
        requestFactory.setReadTimeout(Duration.ofMillis(readTimeoutMs));

        this.restClient = RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(requestFactory)
                .build();
        this.useLlmScoring = useLlmScoring;
    }

    public QuestionAnalysisResult analyzeQuestionAnswer(
            Path audioPath,
            String questionTypeName,
            String questionText,
            String imageDescription
    ) {
        Map<String, Object> body = new HashMap<>();
        body.put("audio_path", audioPath.toAbsolutePath().toString());
        body.put("question_type_name", questionTypeName);
        body.put("question_text", questionText);
        body.put("image_description", imageDescription == null ? "" : imageDescription);
        body.put("use_llm_scoring", useLlmScoring);

        try {
            return restClient.post()
                    .uri("/analyze-question")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(QuestionAnalysisResult.class);
        } catch (RestClientException exception) {
            log.error(
                    "Question analysis server call failed. audioPath={}, questionTypeName={}",
                    audioPath.toAbsolutePath(),
                    questionTypeName,
                    exception
            );
            throw new IllegalStateException(
                    "ANALYSIS_SERVER_UNAVAILABLE: 문항 분석 서버 호출에 실패했습니다. FastAPI 음성 분석 서버(기본 http://localhost:8000)가 실행 중인지 확인하세요.",
                    exception
            );
        }
    }

    public ReportSummaryResult calculateReportSummary(List<ReportAnalysisRow> rows) {
        List<Map<String, Object>> payload = rows.stream()
                .map(this::toMap)
                .toList();

        try {
            return restClient.post()
                    .uri("/report-summary")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .body(ReportSummaryResult.class);
        } catch (RestClientException exception) {
            throw new IllegalStateException(
                    "리포트 요약 서버 호출에 실패했습니다. FastAPI 음성 분석 서버(기본 http://localhost:8000)가 실행 중인지 확인하세요.",
                    exception
            );
        }
    }

    private Map<String, Object> toMap(ReportAnalysisRow row) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("question_type_name", row.questionTypeName());
        payload.put("response_time", row.responseTime());
        payload.put("repetition_ratio", row.repetitionRatio());
        payload.put("avg_sentence_length", row.avgSentenceLength());
        payload.put("appropriateness_score", row.appropriatenessScore());
        return payload;
    }
}
