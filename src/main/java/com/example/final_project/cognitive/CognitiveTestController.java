package com.example.final_project.cognitive;

import com.example.final_project.cognitive.dto.CognitiveTestCompleteRequest;
import com.example.final_project.cognitive.dto.CognitiveTestStartRequest;
import com.example.final_project.cognitive.dto.CognitiveTestStartResponse;
import com.example.final_project.cognitive.dto.QuestionAudioUploadResponse;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/cognitive-tests")
public class CognitiveTestController {

    private final CognitiveTestService cognitiveTestService;

    public CognitiveTestController(CognitiveTestService cognitiveTestService) {
        this.cognitiveTestService = cognitiveTestService;
    }

    @PostMapping("/start")
    public CognitiveTestStartResponse startTest(@Valid @RequestBody CognitiveTestStartRequest request) {
        return cognitiveTestService.startTest(request);
    }

    @PostMapping("/training/start")
    public CognitiveTestStartResponse startTraining(@Valid @RequestBody CognitiveTestStartRequest request) {
        return cognitiveTestService.startTraining(request);
    }

    @PostMapping("/complete")
    public void completeTest(@Valid @RequestBody CognitiveTestCompleteRequest request) {
        cognitiveTestService.completeTest(request);
    }

    @PostMapping(value = "/question-results", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public QuestionAudioUploadResponse uploadQuestionAudio(
            @RequestParam Long performanceId,
            @RequestParam Long questionId,
            @RequestParam("audioFile") MultipartFile audioFile
    ) {
        return cognitiveTestService.saveQuestionAudio(performanceId, questionId, audioFile);
    }

    @GetMapping("/question-results/{questionResultId}")
    public QuestionAudioUploadResponse getQuestionAudioResult(@PathVariable Long questionResultId) {
        return cognitiveTestService.getQuestionAudioResult(questionResultId);
    }

    @GetMapping("/{performanceId}/question-results")
    public List<QuestionAudioUploadResponse> getQuestionAudioResultsByPerformanceId(@PathVariable Long performanceId) {
        return cognitiveTestService.getQuestionAudioResultsByPerformanceId(performanceId);
    }

    @PostMapping("/{performanceId}/reprocess-null-results")
    public java.util.Map<String, Object> reprocessNullResults(@PathVariable Long performanceId) {
        return cognitiveTestService.reprocessNullResults(performanceId);
    }
}
