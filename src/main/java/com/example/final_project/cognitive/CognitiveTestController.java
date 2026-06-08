package com.example.final_project.cognitive;

import com.example.final_project.cognitive.dto.CognitiveTestCompleteRequest;
import com.example.final_project.cognitive.dto.CognitiveTestStartRequest;
import com.example.final_project.cognitive.dto.CognitiveTestStartResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/cognitive-tests")
public class CognitiveTestController {

    private final CognitiveTestService cognitiveTestService;

    public CognitiveTestController(CognitiveTestService cognitiveTestService) {
        this.cognitiveTestService = cognitiveTestService;
    }

    /**
     * 검사 시작 요청을 받으면
     * 수급자 권한 확인 후 유형별 랜덤 문항 묶음을 반환한다.
     */
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
        // 마지막 문항까지 끝난 시점을 검사 완료로 보고 수행 이력을 저장한다.
        cognitiveTestService.completeTest(request);
    }
}
