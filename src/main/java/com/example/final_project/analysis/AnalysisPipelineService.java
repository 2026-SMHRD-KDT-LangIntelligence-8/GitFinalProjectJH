package com.example.final_project.analysis;

import com.example.final_project.analysis.dto.QuestionAnalysisResult;
import com.example.final_project.analysis.dto.ReportAnalysisRow;
import com.example.final_project.analysis.dto.ReportSummaryResult;
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
// 자바 백엔드와 파이썬 음성 분석 FastAPI 서버 사이의 HTTP 호출을 담당한다.
// (과거에는 문항마다 파이썬 프로세스를 새로 띄워 Whisper 모델을 매번 로드했으나,
//  이제는 상주하는 FastAPI 서버를 호출해 모델을 1회만 로드한다.)
public class AnalysisPipelineService {

    private final RestClient restClient;
    private final boolean useLlmScoring;

    public AnalysisPipelineService(
            @Value("${app.speech-analysis.base-url:http://localhost:8000}") String baseUrl,
            @Value("${app.speech-analysis.connect-timeout-ms:5000}") int connectTimeoutMs,
            @Value("${app.speech-analysis.read-timeout-ms:60000}") int readTimeoutMs,
            @Value("${app.speech-analysis.use-llm-scoring:false}") boolean useLlmScoring
    ) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofMillis(connectTimeoutMs));
        // 음성 STT 추론은 CPU에서 10~30초까지 걸릴 수 있으므로 read 타임아웃을 넉넉히 준다.
        requestFactory.setReadTimeout(Duration.ofMillis(readTimeoutMs));

        this.restClient = RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(requestFactory)
                .build();
        this.useLlmScoring = useLlmScoring;
    }

    // 문항 1개의 음성을 분석하고, JSON 결과를 자바 DTO로 변환한다.
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
            throw new IllegalStateException(
                    "문항 분석 서버 호출에 실패했습니다. FastAPI 음성 분석 서버(기본 http://localhost:8000)가 실행 중인지 확인하세요.",
                    exception
            );
        }
    }

    // 리포트는 여러 문항의 분석 행을 파이썬 서버에 전달해 종합 요약값을 계산한다.
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

    // 파이썬 서버가 요구하는 snake_case 키 이름으로 변환한다.
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
