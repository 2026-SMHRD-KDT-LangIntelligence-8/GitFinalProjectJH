package com.example.final_project.analysis;

import com.example.final_project.analysis.dto.QuestionAnalysisResult;
import com.example.final_project.analysis.dto.ReportAnalysisRow;
import com.example.final_project.analysis.dto.ReportSummaryResult;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
// 자바 백엔드와 파이썬 음성 분석 파이프라인 사이의 호출을 담당한다.
public class AnalysisPipelineService {

    private static final Logger log = LoggerFactory.getLogger(AnalysisPipelineService.class);

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final String pythonExecutable;
    private final String questionScriptPath;
    private final String reportScriptPath;
    private final boolean useLlmScoring;

    public AnalysisPipelineService(
            @Value("${app.speech-analysis.python-executable:python}") String pythonExecutable,
            @Value("${app.speech-analysis.question-script:./speech_analysis/run_question_analysis.py}") String questionScriptPath,
            @Value("${app.speech-analysis.report-script:./speech_analysis/run_report_summary.py}") String reportScriptPath,
            @Value("${app.speech-analysis.use-llm-scoring:false}") boolean useLlmScoring
    ) {
        this.pythonExecutable = pythonExecutable;
        this.questionScriptPath = questionScriptPath;
        this.reportScriptPath = reportScriptPath;
        this.useLlmScoring = useLlmScoring;
    }

    // 문항 1개의 음성을 분석하고, JSON 결과를 자바 DTO로 변환한다.
    public QuestionAnalysisResult analyzeQuestionAnswer(
            Path audioPath,
            String questionTypeName,
            String questionText,
            String imageDescription
    ) {
        ProcessBuilder processBuilder = new ProcessBuilder(
                pythonExecutable,
                questionScriptPath,
                "--audio-path", audioPath.toAbsolutePath().toString(),
                "--question-type-name", questionTypeName,
                "--question-text", questionText,
                "--image-description", imageDescription == null ? "" : imageDescription,
                "--use-llm-scoring", Boolean.toString(useLlmScoring)
        );

        processBuilder.redirectErrorStream(true);

        try {
            // 분석 실패 시 어떤 파이썬 실행 경로와 스크립트가 문제였는지 로그에서 바로 확인할 수 있게 남긴다.
            log.info("문항 분석 시작: audioPath={}, script={}", audioPath, questionScriptPath);
            Process process = processBuilder.start();
            String output = readAll(process);
            int exitCode = process.waitFor();

            if (exitCode != 0) {
                log.error("문항 분석 실패: exitCode={}, script={}, output={}", exitCode, questionScriptPath, output);
                throw new IllegalStateException("문항 분석 파이프라인 실행에 실패했습니다. output=" + output);
            }

            JsonNode node = objectMapper.readTree(extractJsonPayload(output));
            return new QuestionAnalysisResult(
                    readText(node, "stt_text"),
                    readText(node, "preprocessed_text"),
                    readDouble(node, "response_time"),
                    readDouble(node, "repetition_ratio"),
                    readDouble(node, "avg_sentence_length"),
                    readInt(node, "appropriateness_score"),
                    readInt(node, "repetition_score"),
                    readInt(node, "sentence_length_score"),
                    readDouble(node, "final_score")
            );
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            log.error("문항 분석 중 인터럽트 발생: script={}, audioPath={}", questionScriptPath, audioPath, exception);
            throw new IllegalStateException("문항 분석 파이프라인을 실행하지 못했습니다.", exception);
        } catch (IOException exception) {
            log.error("문항 분석 실행 실패: python={}, script={}", pythonExecutable, questionScriptPath, exception);
            throw new IllegalStateException("문항 분석 파이프라인을 실행하지 못했습니다.", exception);
        }
    }

    // 리포트는 여러 문항의 분석 행을 파이썬에 전달해 종합 요약값을 계산한다.
    public ReportSummaryResult calculateReportSummary(List<ReportAnalysisRow> rows) {
        ProcessBuilder processBuilder = new ProcessBuilder(
                pythonExecutable,
                reportScriptPath
        );

        processBuilder.redirectErrorStream(true);

        try {
            log.info("리포트 요약 시작: script={}, rowCount={}", reportScriptPath, rows.size());
            Process process = processBuilder.start();
            try (Writer writer = new OutputStreamWriter(process.getOutputStream(), StandardCharsets.UTF_8)) {
                List<Map<String, Object>> payload = rows.stream()
                        .map(this::toMap)
                        .toList();
                objectMapper.writeValue(writer, payload);
            }

            String output = readAll(process);
            int exitCode = process.waitFor();

            if (exitCode != 0) {
                log.error("리포트 요약 실패: exitCode={}, script={}, output={}", exitCode, reportScriptPath, output);
                throw new IllegalStateException("리포트 요약 파이프라인 실행에 실패했습니다. output=" + output);
            }

            return objectMapper.readValue(extractJsonPayload(output), new TypeReference<>() {
            });
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            log.error("리포트 요약 중 인터럽트 발생: script={}", reportScriptPath, exception);
            throw new IllegalStateException("리포트 요약 파이프라인을 실행하지 못했습니다.", exception);
        } catch (IOException exception) {
            log.error("리포트 요약 실행 실패: python={}, script={}", pythonExecutable, reportScriptPath, exception);
            throw new IllegalStateException("리포트 요약 파이프라인을 실행하지 못했습니다.", exception);
        }
    }

    // 파이썬 스크립트가 요구하는 snake_case 키 이름으로 변환한다.
    private Map<String, Object> toMap(ReportAnalysisRow row) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("question_type_name", row.questionTypeName());
        payload.put("response_time", row.responseTime());
        payload.put("repetition_ratio", row.repetitionRatio());
        payload.put("avg_sentence_length", row.avgSentenceLength());
        payload.put("appropriateness_score", row.appropriatenessScore());
        return payload;
    }

    private String readAll(Process process) throws IOException {
        StringBuilder builder = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))
        ) {
            String line;
            while ((line = reader.readLine()) != null) {
                builder.append(line);
            }
        }
        return builder.toString();
    }

    // 표준 출력에 로그가 섞여도 JSON 본문만 잘라 읽기 위한 보정 메서드다.
    private String extractJsonPayload(String output) {
        int firstBraceIndex = output.indexOf('{');
        int lastBraceIndex = output.lastIndexOf('}');
        if (firstBraceIndex < 0 || lastBraceIndex < firstBraceIndex) {
            throw new IllegalStateException("파이프라인 출력에서 JSON을 찾지 못했습니다. output=" + output);
        }
        return output.substring(firstBraceIndex, lastBraceIndex + 1);
    }

    private String readText(JsonNode node, String fieldName) {
        JsonNode fieldNode = node.get(fieldName);
        return fieldNode == null || fieldNode.isNull() ? "" : fieldNode.asText();
    }

    private Double readDouble(JsonNode node, String fieldName) {
        JsonNode fieldNode = node.get(fieldName);
        return fieldNode == null || fieldNode.isNull() ? null : fieldNode.asDouble();
    }

    private Integer readInt(JsonNode node, String fieldName) {
        JsonNode fieldNode = node.get(fieldName);
        return fieldNode == null || fieldNode.isNull() ? null : fieldNode.asInt();
    }
}
