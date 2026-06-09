package com.example.final_project.cognitive;

import com.example.final_project.cognitive.dto.CognitiveTestCompleteRequest;
import com.example.final_project.cognitive.dto.CognitiveTestStartRequest;
import com.example.final_project.cognitive.dto.CognitiveTestStartResponse;
import com.example.final_project.cognitive.dto.QuestionAudioUploadResponse;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

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
}
