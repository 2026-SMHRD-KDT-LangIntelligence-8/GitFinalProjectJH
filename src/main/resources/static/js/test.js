const TEST_DURATION_SECONDS = 70;
const TEST_PROGRESS_STORAGE_KEY = "latestCognitiveTestProgress";
const DEFAULT_AUDIO_FILE_NAME = "answer.webm";
const SpeechRecognitionConstructor = window.SpeechRecognition || window.webkitSpeechRecognition;
const AUDIO_LEVEL_CHECK_MIN_RMS = 0.003;
const AUDIO_LEVEL_CHECK_MIN_PEAK = 0.02;
const AUDIO_LEVEL_CHECK_MIN_ACTIVE_RATIO = 0.015;

const FAILURE_MESSAGE_BY_CODE = {
    LOW_VOLUME_OR_SILENCE: "음성이 너무 작거나 무음으로 감지되었습니다. 휴대폰을 입 가까이에 두고 다시 검사해 주세요.",
    AUDIO_UPLOAD_FAILED: "음성 업로드 중 문제가 발생했습니다. 네트워크 상태를 확인한 뒤 다시 검사해 주세요.",
    RESULT_FETCH_FAILED: "서버에서 텍스트 변환 결과를 가져오지 못했습니다. 잠시 후 다시 확인해 주세요.",
    RESULT_POLL_TIMEOUT: "서버의 텍스트 변환이 오래 걸리고 있습니다. 잠시 후 다시 확인해 주세요.",
    ANALYSIS_SERVER_UNAVAILABLE: "음성 분석 서버와 연결하지 못했습니다. 잠시 후 다시 검사해 주세요.",
    ANALYSIS_PROCESSING_FAILED: "음성 파일 분석 중 문제가 발생했습니다. 다시 검사해 주세요.",
    TEXT_CONVERSION_FAILED: "텍스트 변환에 실패했습니다. 다시 검사해 주세요."
};

// 검사 페이지는 음성 인식, 음성 파일 저장, 텍스트 확인 UI를 한 스크립트에서 관리한다.
document.addEventListener("DOMContentLoaded", async () => {
    const backButton = document.getElementById("test-back-btn");
    const recipientSelect = document.getElementById("recipient-select");
    const startButton = document.getElementById("start-test-btn");
    const introView = document.getElementById("test-intro-view");
    const sessionView = document.getElementById("test-session-view");
    const recipientNameChip = document.getElementById("recipient-name-chip");
    const questionProgressChip = document.getElementById("question-progress-chip");
    const questionTimer = document.getElementById("question-timer");
    const questionTypeName = document.getElementById("question-type-name");
    const questionSequenceText = document.getElementById("question-sequence-text");
    const questionText = document.getElementById("question-text");
    const questionPurpose = document.getElementById("question-purpose");
    const questionImageWrap = document.getElementById("question-image-wrap");
    const questionImage = document.getElementById("question-image");
    const questionCriteria = document.getElementById("question-criteria");
    const timerStartButton = document.getElementById("timer-start-btn");
    const voiceBadge = document.getElementById("question-voice-badge");
    const voiceGuide = document.getElementById("question-voice-guide");
    const voiceTranscript = document.getElementById("question-voice-transcript");
    const voiceReviewText = document.getElementById("voice-review-text");
    const reviewView = document.getElementById("test-review-view");
    const reviewStatus = document.getElementById("test-review-status");
    const reviewList = document.getElementById("test-review-list");
    const reviewFinishButton = document.getElementById("review-finish-btn");
    const finalizingOverlay = document.getElementById("test-finalizing-overlay");
    const finalizingDescription = document.getElementById("test-finalizing-description");

    const state = {
        performanceId: null,
        recipientId: null,
        recipientName: "",
        questions: [],
        currentIndex: 0,
        timerId: null,
        remainingSeconds: TEST_DURATION_SECONDS,
        questionDurationSeconds: TEST_DURATION_SECONDS,
        timerStarted: false,
        completedQuestionIds: [],
        timedOutQuestionIds: [],
        questionResultIdsByQuestionId: {},
        transcriptsByQuestionId: {},
        dbTranscriptsByQuestionId: {},
        finalScoresByQuestionId: {},
        recognition: null,
        recognitionSupported: Boolean(SpeechRecognitionConstructor),
        mediaStream: null,
        mediaRecorder: null,
        mediaRecorderSupported: typeof MediaRecorder !== "undefined",
        recordedChunks: [],
        audioContext: null,
        voiceAnalyser: null,
        voiceSource: null,
        voiceDataArray: null,
        voiceAnimationId: null,
        questionAdvancePending: false,
        pendingAnalysisTasks: new Map(),
        analysisFailuresByQuestionId: {},
        finalizing: false,
        completed: false,
        reviewPollingTimerId: null,
        reviewPollingBusy: false,
        shouldPersistProgress: true
    };

    setVoiceState("idle");

    try {
        await loadRecipients(recipientSelect);
        await restoreTestProgressIfAvailable();
    } catch (error) {
        console.error(error);
        alert("수급자 목록을 불러오지 못했습니다.");
    }

    startButton.addEventListener("click", async () => {
        if (!recipientSelect.value) {
            alert("수급자를 먼저 선택해주세요.");
            return;
        }

        startButton.disabled = true;

        try {
            const payload = await startTest(recipientSelect.value);
            state.performanceId = payload.performanceId;
            state.recipientId = payload.recipientId;
            state.recipientName = payload.recipientName;
            state.questions = payload.questions;
            state.currentIndex = 0;
            state.questionDurationSeconds = payload.questionDurationSeconds || TEST_DURATION_SECONDS;
            state.remainingSeconds = state.questionDurationSeconds;
            state.timerStarted = false;
            state.completedQuestionIds = [];
            state.timedOutQuestionIds = [];
            state.questionResultIdsByQuestionId = {};
            state.transcriptsByQuestionId = {};
            state.dbTranscriptsByQuestionId = {};
            // 문항별 최종 점수는 훈련 추천과 리포트 계산에 다시 활용할 수 있게 별도로 저장한다.
            state.finalScoresByQuestionId = {};
            state.pendingAnalysisTasks = new Map();
            state.analysisFailuresByQuestionId = {};
            state.finalizing = false;
            state.completed = false;

            saveTestProgress(state);
            setFinalizingState(false);

            introView.classList.add("hidden");
            sessionView.classList.remove("hidden");
            recipientNameChip.textContent = `${payload.recipientName} 검사`;
            timerStartButton.disabled = false;

            renderCurrentQuestion();
        } catch (error) {
            console.error(error);
            alert("검사 문항을 불러오지 못했습니다.");
            startButton.disabled = false;
        }
    });

    timerStartButton.addEventListener("click", async () => {
        if (state.timerStarted) {
            await moveToNextQuestion(false);
            return;
        }

        timerStartButton.textContent = "넘어가기";
        state.timerStarted = true;
        runQuestionTimer();

        try {
            await ensureMicrophoneReady(state);
            startVoiceRecognition();
            startAudioRecording(state);
            startVoicePulse();
        } catch (error) {
            console.error(error);
            setVoiceState("error", "마이크 권한을 허용해야 음성 인식을 사용할 수 있습니다.");
        }
    });

    window.addEventListener("beforeunload", () => {
        stopVoiceRecognition();
        stopVoicePulse();
        stopReviewPolling();
        releaseMediaStream(state);
        if (state.shouldPersistProgress && state.questions.length > 0) {
            saveTestProgress(state, state.completed);
        }
    });

    backButton?.addEventListener("click", () => {
        clearPersistedTestProgress(state);
    });

    reviewFinishButton?.addEventListener("click", () => {
        stopReviewPolling();
        clearPersistedTestProgress(state);
        window.location.href = "/main";
    });

    async function restoreTestProgressIfAvailable() {
        const rawProgress = sessionStorage.getItem(TEST_PROGRESS_STORAGE_KEY);
        if (!rawProgress) {
            return;
        }

        try {
            const saved = JSON.parse(rawProgress);
            if (!saved || !Array.isArray(saved.questions) || !saved.questions.length) {
                return;
            }

            state.performanceId = saved.performanceId ?? null;
            state.recipientId = saved.recipientId ?? null;
            state.recipientName = saved.recipientName ?? "";
            state.questions = saved.questions;
            state.currentIndex = Math.min(saved.currentIndex ?? 0, Math.max(saved.questions.length - 1, 0));
            state.completedQuestionIds = Array.isArray(saved.completedQuestionIds) ? saved.completedQuestionIds : [];
            state.timedOutQuestionIds = Array.isArray(saved.timedOutQuestionIds) ? saved.timedOutQuestionIds : [];
            state.questionResultIdsByQuestionId = {...(saved.questionResultIdsByQuestionId || {})};
            state.transcriptsByQuestionId = {...(saved.transcriptsByQuestionId || {})};
            state.dbTranscriptsByQuestionId = {...(saved.dbTranscriptsByQuestionId || {})};
            state.finalScoresByQuestionId = {...(saved.finalScoresByQuestionId || saved.questionScoresById || {})};
            state.analysisFailuresByQuestionId = {...(saved.analysisFailuresByQuestionId || {})};
            if (!Object.keys(state.analysisFailuresByQuestionId).length && Array.isArray(saved.analysisFailureQuestionIds)) {
                saved.analysisFailureQuestionIds.forEach((questionId) => {
                    state.analysisFailuresByQuestionId[questionId] = toFailureInfo({failureCode: "TEXT_CONVERSION_FAILED"});
                });
            }
            state.completed = Boolean(saved.completed);
            state.finalizing = false;
            state.timerStarted = false;
            state.remainingSeconds = state.questionDurationSeconds;

            if (state.recipientId) {
                recipientSelect.value = String(state.recipientId);
            }

            if (state.completed) {
                if (!isReloadNavigation()) {
                    clearPersistedTestProgress(state);
                    return;
                }

                introView.classList.add("hidden");
                sessionView.classList.add("hidden");
                reviewView.classList.remove("hidden");
                await refreshPerformanceResults();
                renderFinalReview();
                updateReviewStatus();
                startReviewPolling();
                return;
            }

            introView.classList.add("hidden");
            reviewView.classList.add("hidden");
            sessionView.classList.remove("hidden");
            recipientNameChip.textContent = `${state.recipientName} 검사`;
            timerStartButton.textContent = "검사 시작";
            timerStartButton.disabled = false;
            renderCurrentQuestion();
        } catch (error) {
            console.error(error);
            sessionStorage.removeItem(TEST_PROGRESS_STORAGE_KEY);
        }
    }

    function renderCurrentQuestion() {
        const currentQuestion = state.questions[state.currentIndex];
        if (!currentQuestion) {
            return;
        }

        questionProgressChip.textContent = `${state.currentIndex + 1} / ${state.questions.length}`;
        questionTypeName.textContent = currentQuestion.questionTypeName;
        questionSequenceText.textContent = "";
        questionSequenceText.classList.add("hidden");
        questionText.textContent = currentQuestion.questionText;

        questionPurpose.textContent = "";
        questionPurpose.classList.add("hidden");

        const normalizedImagePath = normalizeImagePath(currentQuestion.imageFilePath);
        if (normalizedImagePath) {
            questionImage.src = normalizedImagePath;
            questionImageWrap.classList.remove("hidden");
        } else {
            questionImage.removeAttribute("src");
            questionImageWrap.classList.add("hidden");
        }

        questionCriteria.textContent = "";
        questionCriteria.classList.add("hidden");

        updateVoiceTranscript(currentQuestion.questionId);
        renderVoiceReview(currentQuestion.questionId);
        setVoiceState("idle");
        updateTimerText(state.remainingSeconds);
        saveTestProgress(state);
    }

    function runQuestionTimer() {
        clearQuestionTimer();
        updateTimerText(state.remainingSeconds);

        state.timerId = window.setInterval(() => {
            state.remainingSeconds -= 1;
            updateTimerText(state.remainingSeconds);

            if (state.remainingSeconds <= 0) {
                clearQuestionTimer();
                moveToNextQuestion(true).catch((error) => {
                    console.error(error);
                });
            }
        }, 1000);
    }

    function markQuestionCompleted(questionId, timedOut) {
        if (!state.completedQuestionIds.includes(questionId)) {
            state.completedQuestionIds.push(questionId);
        }

        if (timedOut && !state.timedOutQuestionIds.includes(questionId)) {
            state.timedOutQuestionIds.push(questionId);
        }

        saveTestProgress(state);
    }

    function clearQuestionTimer() {
        if (state.timerId !== null) {
            window.clearInterval(state.timerId);
            state.timerId = null;
        }
    }

    function updateTimerText(remainingSeconds) {
        const safeSeconds = Math.max(remainingSeconds, 0);
        const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, "0");
        const seconds = String(safeSeconds % 60).padStart(2, "0");
        questionTimer.textContent = `${minutes}:${seconds}`;
    }

    async function ensureMicrophoneReady(currentState) {
        if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error("microphone_not_supported");
        }

        if (currentState.mediaStream) {
            return currentState.mediaStream;
        }

        currentState.mediaStream = await navigator.mediaDevices.getUserMedia({audio: true});
        return currentState.mediaStream;
    }

    function startVoiceRecognition() {
        const currentQuestion = state.questions[state.currentIndex];
        if (!currentQuestion) {
            return;
        }

        if (!state.recognitionSupported) {
            setVoiceState("error", "현재 브라우저는 자동 음성 인식을 지원하지 않습니다.");
            return;
        }

        stopVoiceRecognition();

        const recognition = new SpeechRecognitionConstructor();
        recognition.lang = "ko-KR";
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onstart = () => {
            setVoiceState("listening");
        };

        recognition.onresult = (event) => {
            let transcript = "";
            for (let index = event.resultIndex; index < event.results.length; index += 1) {
                transcript += event.results[index][0].transcript;
            }

            const trimmedTranscript = transcript.trim();
            if (!trimmedTranscript) {
                return;
            }

            state.transcriptsByQuestionId[currentQuestion.questionId] = trimmedTranscript;
            voiceTranscript.textContent = "";
            renderVoiceReview(currentQuestion.questionId);
            saveTestProgress(state);
        };

        recognition.onerror = (event) => {
            if (event.error === "no-speech") {
                setVoiceState("idle", "말씀해주시면 자동으로 음성을 다시 듣습니다.");
                return;
            }

            setVoiceState("error", "음성 인식 중 문제가 발생했습니다. 다시 시도해주세요.");
        };

        recognition.onend = () => {
            if (!state.timerStarted || !state.recognition) {
                return;
            }

            try {
                recognition.start();
            } catch (error) {
                console.error(error);
            }
        };

        state.recognition = recognition;

        try {
            recognition.start();
        } catch (error) {
            console.error(error);
            setVoiceState("error", "마이크를 다시 시작하지 못했습니다.");
        }
    }

    function stopVoiceRecognition() {
        if (!state.recognition) {
            return;
        }

        const recognition = state.recognition;
        state.recognition = null;

        try {
            recognition.onend = null;
            recognition.stop();
        } catch (error) {
            console.error(error);
        }

        setVoiceState("idle");
    }

    function setVoiceState(mode, customMessage) {
        voiceBadge.classList.remove("is-listening", "is-error");

        if (mode === "listening") {
            voiceBadge.classList.add("is-listening");
            voiceBadge.textContent = "마이크 사용 중";
            voiceGuide.textContent = customMessage || "질문에 답하시면 음성이 자동으로 인식됩니다.";
            return;
        }

        if (mode === "error") {
            voiceBadge.classList.add("is-error");
            voiceBadge.textContent = "음성 인식 안내";
            voiceGuide.textContent = customMessage || "현재 기기에서는 음성 인식을 사용할 수 없습니다.";
            return;
        }

        voiceBadge.textContent = "음성 대기";
        voiceGuide.textContent = customMessage || "검사 시작을 누르면 마이크가 활성화됩니다.";
    }

    function updateVoiceTranscript(questionId) {
        voiceTranscript.textContent = "";
        voiceTranscript.classList.remove("is-listening");
        voiceTranscript.style.setProperty("--voice-pulse-scale", "1");
        voiceTranscript.style.setProperty("--voice-pulse-shadow", "6px");
    }

    function renderVoiceReview(questionId) {
        if (!voiceReviewText) {
            return;
        }

        const transcript = state.dbTranscriptsByQuestionId[questionId]?.trim() || "";
        const failure = getQuestionFailure(state, questionId);
        const questionCompleted = state.completedQuestionIds.includes(questionId);

        if (failure) {
            voiceReviewText.textContent = failure.message;
            voiceReviewText.classList.remove("hidden");
            return;
        }

        if (transcript) {
            voiceReviewText.textContent = transcript;
            voiceReviewText.classList.remove("hidden");
            return;
        }

        if (state.timerStarted) {
            voiceReviewText.textContent = "음성을 듣는 중입니다. 답변이 끝나고 문항이 넘어가면 최종 인식 텍스트가 여기에 표시됩니다.";
            voiceReviewText.classList.remove("hidden");
            return;
        }

        if (questionCompleted) {
            voiceReviewText.textContent = "음성 업로드는 완료되었고, 최종 인식 텍스트를 정리 중입니다. 잠시만 기다려 주세요.";
            voiceReviewText.classList.remove("hidden");
            return;
        }

        voiceReviewText.textContent = "검사를 시작하면 이 영역에 서버 기준 최종 인식 텍스트가 표시됩니다.";
        voiceReviewText.classList.remove("hidden");
    }

    function renderFinalReview() {
        reviewList.innerHTML = state.questions.map((question, index) => {
            const dbTranscript = String(state.dbTranscriptsByQuestionId[question.questionId] || "").trim();
            const failure = getQuestionFailure(state, question.questionId);
            const transcriptMarkup = failure
                ? `<div class="test-review-pending">${escapeHtml(failure.message)}</div>`
                : dbTranscript
                    ? `
                        <div class="test-review-transcript-header">
                            <span class="test-review-saved-badge">서버 저장 완료</span>
                        </div>
                        <div class="test-review-transcript">${escapeHtml(dbTranscript)}</div>
                    `
                    : '<div class="test-review-pending">서버에서 음성 데이터를 텍스트로 변환중입니다. 잠시만 기다려주세요.</div>';

            return `
                <div class="test-review-item">
                    <div class="test-review-question">${index + 1}. ${escapeHtml(question.questionTypeName)} - ${escapeHtml(question.questionText)}</div>
                    ${transcriptMarkup}
                </div>
            `;
        }).join("");
    }

    function updateReviewStatus() {
        if (!reviewStatus) {
            return;
        }

        const pendingQuestionIds = getPendingQuestionIds();
        reviewStatus.classList.remove("hidden", "is-complete", "is-error");

        const failureQuestionIds = getFailureQuestionIds(state);
        if (failureQuestionIds.length > 0) {
            reviewStatus.classList.add("is-error");
            reviewStatus.textContent = buildFailureSummaryText(state, failureQuestionIds);
            return;
        }

        if (pendingQuestionIds.length > 0) {
            reviewStatus.textContent = `남은 ${pendingQuestionIds.length}건의 최종 텍스트를 서버에서 확인 중입니다. 이 화면을 벗어나지 않아도 다른 문항 결과부터 바로 확인할 수 있습니다.`;
            return;
        }

        reviewStatus.classList.add("is-complete");
        reviewStatus.textContent = "모든 문항의 서버 저장 답변 텍스트 확인이 완료되었습니다.";
    }

    function startVoicePulse() {
        const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextConstructor || !state.mediaStream || state.voiceAnimationId) {
            return;
        }

        state.audioContext = state.audioContext || new AudioContextConstructor();
        if (state.audioContext.state === "suspended") {
            state.audioContext.resume().catch((error) => console.error(error));
        }

        state.voiceAnalyser = state.audioContext.createAnalyser();
        state.voiceAnalyser.fftSize = 256;
        state.voiceAnalyser.smoothingTimeConstant = 0.72;
        state.voiceSource = state.audioContext.createMediaStreamSource(state.mediaStream);
        state.voiceSource.connect(state.voiceAnalyser);
        state.voiceDataArray = new Uint8Array(state.voiceAnalyser.fftSize);
        voiceTranscript.classList.add("is-listening");

        const updatePulse = () => {
            state.voiceAnalyser.getByteTimeDomainData(state.voiceDataArray);

            let sum = 0;
            for (const value of state.voiceDataArray) {
                const normalized = (value - 128) / 128;
                sum += normalized * normalized;
            }

            const volume = Math.min(Math.sqrt(sum / state.voiceDataArray.length) * 7, 1);
            const scale = 1 + volume * 1.7;
            const shadow = 6 + volume * 26;
            voiceTranscript.style.setProperty("--voice-pulse-scale", scale.toFixed(2));
            voiceTranscript.style.setProperty("--voice-pulse-shadow", `${shadow.toFixed(0)}px`);
            state.voiceAnimationId = window.requestAnimationFrame(updatePulse);
        };

        updatePulse();
    }

    function stopVoicePulse() {
        if (state.voiceAnimationId) {
            window.cancelAnimationFrame(state.voiceAnimationId);
            state.voiceAnimationId = null;
        }

        if (state.voiceSource) {
            state.voiceSource.disconnect();
            state.voiceSource = null;
        }

        state.voiceAnalyser = null;
        state.voiceDataArray = null;
        voiceTranscript.classList.remove("is-listening");
        voiceTranscript.style.setProperty("--voice-pulse-scale", "1");
        voiceTranscript.style.setProperty("--voice-pulse-shadow", "6px");
    }

    function setFinalizingState(visible, message) {
        finalizingOverlay.classList.add("hidden");
        finalizingDescription.textContent = message
            || "남은 음성 업로드와 분석을 마무리하고 있습니다. 잠시만 기다려주세요.";
    }

    async function moveToNextQuestion(timedOut) {
        const currentQuestion = state.questions[state.currentIndex];
        if (!currentQuestion || state.questionAdvancePending) {
            return;
        }

        // 문항 이동은 바로 진행하고 음성 업로드/분석은 뒤에서 계속 처리한다.
        state.questionAdvancePending = true;
        clearQuestionTimer();
        stopVoiceRecognition();
        stopVoicePulse();
        queueQuestionAnalysis(state, currentQuestion);
        state.questionAdvancePending = false;

        state.timerStarted = false;
        markQuestionCompleted(currentQuestion.questionId, timedOut);

        if (state.currentIndex >= state.questions.length - 1) {
            await finishTest();
            return;
        }

        state.currentIndex += 1;
        state.remainingSeconds = state.questionDurationSeconds;
        timerStartButton.textContent = "검사 시작";
        timerStartButton.disabled = false;
        renderCurrentQuestion();
    }

    function getPendingQuestionIds() {
        return state.questions
            .map((question) => question.questionId)
            .filter((questionId) => {
                if (getQuestionFailure(state, questionId)) {
                    return false;
                }

                const savedTranscript = String(state.dbTranscriptsByQuestionId[questionId] || "").trim();
                return !savedTranscript;
            });
    }

    async function refreshPerformanceResults() {
        if (!state.performanceId) {
            return;
        }

        const response = await fetch(`/api/cognitive-tests/${state.performanceId}/question-results`);
        if (!response.ok) {
            throw new Error("performance_question_results_fetch_failed");
        }

        const results = await response.json();
        results.forEach((result) => {
            const questionId = Number(result.questionId);
            if (!questionId) {
                return;
            }

            if (result.questionResultId) {
                state.questionResultIdsByQuestionId[questionId] = result.questionResultId;
            }

            applyQuestionAnalysisResult(state, questionId, result);
        });
    }

    async function pollReviewResultsOnce() {
        if (state.reviewPollingBusy) {
            return;
        }

        state.reviewPollingBusy = true;
        try {
            await refreshPerformanceResults();
            renderFinalReview();
            updateReviewStatus();

            if (!getPendingQuestionIds().length) {
                stopReviewPolling();
            }
        } catch (error) {
            console.error(error);
            if (reviewStatus) {
                reviewStatus.classList.remove("hidden", "is-complete");
                reviewStatus.classList.add("is-error");
                reviewStatus.textContent = "최종 인식 텍스트를 다시 불러오는 중 문제가 발생했습니다. 잠시 후 새로고침하면 이어서 다시 확인합니다.";
            }
        } finally {
            state.reviewPollingBusy = false;
        }
    }

    function startReviewPolling() {
        stopReviewPolling();
        if (!state.completed) {
            return;
        }

        if (!getPendingQuestionIds().length) {
            updateReviewStatus();
            return;
        }

        state.reviewPollingTimerId = window.setInterval(() => {
            pollReviewResultsOnce().catch((error) => console.error(error));
        }, 2000);
    }

    function stopReviewPolling() {
        if (state.reviewPollingTimerId !== null) {
            window.clearInterval(state.reviewPollingTimerId);
            state.reviewPollingTimerId = null;
        }
    }

    async function finishTest() {
        if (state.finalizing) {
            return;
        }

        state.finalizing = true;
        state.completed = true;
        timerStartButton.disabled = true;
        stopVoiceRecognition();
        stopVoicePulse();
        releaseMediaStream(state);

        saveTestProgress(state, true);
        await completeTest(state.recipientId);
        introView.classList.add("hidden");
        sessionView.classList.add("hidden");
        reviewView.classList.remove("hidden");
        await refreshPerformanceResults();
        renderFinalReview();
        updateReviewStatus();
        startReviewPolling();
        state.finalizing = false;
    }
});

function startAudioRecording(state) {
    if (!state.mediaRecorderSupported || !state.mediaStream) {
        return;
    }

    if (state.mediaRecorder && state.mediaRecorder.state !== "inactive") {
        return;
    }

    state.recordedChunks = [];

    const mediaRecorder = new MediaRecorder(state.mediaStream);
    mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
            state.recordedChunks.push(event.data);
        }
    };

    state.mediaRecorder = mediaRecorder;
    mediaRecorder.start();
}

function queueQuestionAnalysis(state, question) {
    const analysisTask = stopRecordingAndUpload(state, question)
        .catch((error) => {
            console.error(error);
            setQuestionFailure(state, question.questionId, toFailureInfo(error));
        })
        .finally(() => {
            state.pendingAnalysisTasks.delete(question.questionId);
        });

    state.pendingAnalysisTasks.set(question.questionId, analysisTask);
}

async function stopRecordingAndUpload(state, question) {
    if (!state.mediaRecorder || state.mediaRecorder.state === "inactive") {
        return;
    }

    const audioBlob = await new Promise((resolve) => {
        state.mediaRecorder.onstop = () => {
            resolve(new Blob(state.recordedChunks, {type: state.mediaRecorder.mimeType || "audio/webm"}));
        };
        state.mediaRecorder.stop();
    });

    state.mediaRecorder = null;
    state.recordedChunks = [];

    if (!audioBlob || audioBlob.size === 0) {
        throw createClientError("LOW_VOLUME_OR_SILENCE");
    }

    await validateRecordedAudio(audioBlob);

    const uploadResult = await uploadQuestionAudio(state.performanceId, question.questionId, audioBlob);
    clearQuestionFailure(state, question.questionId);
    if (uploadResult?.questionResultId) {
        state.questionResultIdsByQuestionId[question.questionId] = uploadResult.questionResultId;
    }
    applyQuestionAnalysisResult(state, question.questionId, uploadResult);

    if (uploadResult?.questionResultId) {
        const finalResult = await waitForQuestionAudioResult(uploadResult.questionResultId);
        applyQuestionAnalysisResult(state, question.questionId, finalResult);
    }
}

function releaseMediaStream(state) {
    if (!state.mediaStream) {
        return;
    }

    state.mediaStream.getTracks().forEach((track) => track.stop());
    state.mediaStream = null;
}

async function uploadQuestionAudio(performanceId, questionId, audioBlob) {
    const formData = new FormData();
    formData.append("performanceId", String(performanceId));
    formData.append("questionId", String(questionId));
    formData.append("audioFile", audioBlob, DEFAULT_AUDIO_FILE_NAME);

    const response = await fetch("/api/cognitive-tests/question-results", {
        method: "POST",
        body: formData
    });

    if (!response.ok) {
        throw createClientError("AUDIO_UPLOAD_FAILED");
    }

    return response.json();
}

async function waitForQuestionAudioResult(questionResultId) {
    const maxAttempts = 20;
    let lastResult = null;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const result = await fetchQuestionAudioResult(questionResultId);
        lastResult = result;
        if (result.analysisStatus === "COMPLETED" || result.analysisStatus === "FAILED") {
            return result;
        }

        await delay(1500);
    }

    if (lastResult) {
        return lastResult;
    }

    throw createClientError("RESULT_POLL_TIMEOUT");
}

async function fetchQuestionAudioResult(questionResultId) {
    const response = await fetch(`/api/cognitive-tests/question-results/${questionResultId}`);
    if (!response.ok) {
        throw createClientError("RESULT_FETCH_FAILED");
    }

    return response.json();
}

async function loadRecipients(recipientSelect) {
    const response = await fetch("/api/recipients");
    if (!response.ok) {
        throw new Error("recipient_fetch_failed");
    }

    const recipients = await response.json();
    recipients.forEach((recipient) => {
        const option = document.createElement("option");
        option.value = String(recipient.recipientId);
        option.textContent = recipient.recipientName;
        recipientSelect.appendChild(option);
    });
}

async function startTest(recipientId) {
    const response = await fetch("/api/cognitive-tests/start", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            recipientId: Number(recipientId)
        })
    });

    if (!response.ok) {
        throw new Error("test_start_failed");
    }

    return response.json();
}

async function completeTest(recipientId) {
    const response = await fetch("/api/cognitive-tests/complete", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            recipientId: Number(recipientId)
        })
    });

    if (!response.ok) {
        throw new Error("test_complete_failed");
    }
}

function saveTestProgress(state, completed = false) {
    const questionsByType = new Map();
    const typeScoreBuckets = new Map();
    const questionScoresById = {};

    state.questions.forEach((question) => {
        const currentCount = questionsByType.get(question.questionTypeId) || 0;
        questionsByType.set(question.questionTypeId, currentCount + 1);
        const timedOut = state.timedOutQuestionIds.includes(question.questionId);
        const questionScore = calculateQuestionScore(state, question, timedOut);

        questionScoresById[question.questionId] = questionScore;

        if (!typeScoreBuckets.has(question.questionTypeId)) {
            typeScoreBuckets.set(question.questionTypeId, []);
        }

        typeScoreBuckets.get(question.questionTypeId).push(questionScore);
    });

    const questionTypeScores = state.questions
        .reduce((accumulator, question) => {
            if (accumulator.some((item) => item.questionTypeId === question.questionTypeId)) {
                return accumulator;
            }

            const scores = typeScoreBuckets.get(question.questionTypeId) || [];
            accumulator.push({
                questionTypeId: question.questionTypeId,
                questionTypeName: question.questionTypeName,
                averageScore: calculateAverageScore(scores)
            });
            return accumulator;
        }, []);

    const weakTypeIds = completed
        ? questionTypeScores
            .filter((item) => item.averageScore < 60)
            .map((item) => item.questionTypeId)
        : [];

    const summary = {
        performanceId: state.performanceId,
        recipientId: state.recipientId,
        recipientName: state.recipientName,
        completed,
        currentIndex: state.currentIndex,
        completedQuestionIds: [...state.completedQuestionIds],
        timedOutQuestionIds: [...state.timedOutQuestionIds],
        weakTypeIds,
        questionScoresById,
        finalScoresByQuestionId: {...state.finalScoresByQuestionId},
        questionResultIdsByQuestionId: {...state.questionResultIdsByQuestionId},
        questionTypeScores,
        transcriptsByQuestionId: {...state.transcriptsByQuestionId},
        dbTranscriptsByQuestionId: {...state.dbTranscriptsByQuestionId},
        analysisFailuresByQuestionId: {...state.analysisFailuresByQuestionId},
        questions: state.questions.map((question) => ({
            questionId: question.questionId,
            questionTypeId: question.questionTypeId,
            questionTypeName: question.questionTypeName,
            questionText: question.questionText,
            imageFilePath: question.imageFilePath || ""
        }))
    };

    sessionStorage.setItem(TEST_PROGRESS_STORAGE_KEY, JSON.stringify(summary));
}

function clearPersistedTestProgress(state) {
    if (state) {
        state.shouldPersistProgress = false;
    }

    sessionStorage.removeItem(TEST_PROGRESS_STORAGE_KEY);
}

function isReloadNavigation() {
    const navigationEntry = performance.getEntriesByType("navigation")[0];
    if (navigationEntry && navigationEntry.type) {
        return navigationEntry.type === "reload";
    }

    if (performance.navigation) {
        return performance.navigation.type === performance.navigation.TYPE_RELOAD;
    }

    return false;
}

function getFailureQuestionIds(state) {
    return Object.keys(state.analysisFailuresByQuestionId || {}).map((questionId) => Number(questionId));
}

function getQuestionFailure(state, questionId) {
    return state.analysisFailuresByQuestionId?.[questionId] || null;
}

function setQuestionFailure(state, questionId, failure) {
    if (!failure) {
        return;
    }

    state.analysisFailuresByQuestionId[questionId] = failure;
    saveTestProgress(state, Boolean(state.completed));
}

function clearQuestionFailure(state, questionId) {
    if (!state.analysisFailuresByQuestionId?.[questionId]) {
        return;
    }

    delete state.analysisFailuresByQuestionId[questionId];
    saveTestProgress(state, Boolean(state.completed));
}

function createClientError(code, detail) {
    const error = new Error(detail || FAILURE_MESSAGE_BY_CODE[code] || "텍스트 변환에 실패했습니다. 다시 검사해 주세요.");
    error.failureCode = code;
    error.failureDetail = detail || null;
    return error;
}

function toFailureInfo(source) {
    const detail = String(source?.failureDetail || source?.analysisMessage || source?.message || "").trim();
    const code = String(source?.failureCode || "").trim() || inferFailureCodeFromDetail(detail);
    return {
        code,
        detail,
        message: resolveFailureMessage(code, detail)
    };
}

function inferFailureCodeFromDetail(detail) {
    if (detail.includes("너무 작") || detail.includes("무음")) {
        return "LOW_VOLUME_OR_SILENCE";
    }
    if (detail.includes("분석 서버") || detail.includes("통신")) {
        return "ANALYSIS_SERVER_UNAVAILABLE";
    }
    if (detail.includes("업로드")) {
        return "AUDIO_UPLOAD_FAILED";
    }
    if (detail.includes("가져오지 못")) {
        return "RESULT_FETCH_FAILED";
    }
    return "TEXT_CONVERSION_FAILED";
}

function resolveFailureMessage(code, detail) {
    if (detail) {
        return detail;
    }

    return FAILURE_MESSAGE_BY_CODE[code] || FAILURE_MESSAGE_BY_CODE.TEXT_CONVERSION_FAILED;
}

function buildFailureSummaryText(state, failureQuestionIds) {
    const groupedCounts = new Map();

    failureQuestionIds.forEach((questionId) => {
        const failure = getQuestionFailure(state, questionId);
        const code = failure?.code || "TEXT_CONVERSION_FAILED";
        groupedCounts.set(code, (groupedCounts.get(code) || 0) + 1);
    });

    const summary = Array.from(groupedCounts.entries())
        .map(([code, count]) => `${resolveFailureTitle(code)} ${count}건`)
        .join(", ");

    return `일부 문항의 텍스트 변환이 완료되지 않았습니다. ${summary}입니다. 실패 문항은 다시 검사해 주세요.`;
}

function resolveFailureTitle(code) {
    switch (code) {
        case "LOW_VOLUME_OR_SILENCE":
            return "저음량 또는 무음";
        case "AUDIO_UPLOAD_FAILED":
            return "음성 업로드 실패";
        case "RESULT_FETCH_FAILED":
        case "RESULT_POLL_TIMEOUT":
            return "결과 조회 지연";
        case "ANALYSIS_SERVER_UNAVAILABLE":
            return "분석 서버 연결 실패";
        case "ANALYSIS_PROCESSING_FAILED":
            return "음성 분석 실패";
        default:
            return "텍스트 변환 실패";
    }
}

async function validateRecordedAudio(audioBlob) {
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) {
        return;
    }

    const context = new AudioContextConstructor();

    try {
        const audioBuffer = await context.decodeAudioData(await audioBlob.arrayBuffer());
        const channelData = audioBuffer.getChannelData(0);

        if (!channelData?.length) {
            throw createClientError("LOW_VOLUME_OR_SILENCE");
        }

        let squaredSum = 0;
        let peak = 0;
        let activeSampleCount = 0;

        for (const sample of channelData) {
            const amplitude = Math.abs(sample);
            squaredSum += amplitude * amplitude;
            peak = Math.max(peak, amplitude);
            if (amplitude >= AUDIO_LEVEL_CHECK_MIN_PEAK) {
                activeSampleCount += 1;
            }
        }

        const rms = Math.sqrt(squaredSum / channelData.length);
        const activeRatio = activeSampleCount / channelData.length;

        if (rms < AUDIO_LEVEL_CHECK_MIN_RMS && peak < AUDIO_LEVEL_CHECK_MIN_PEAK && activeRatio < AUDIO_LEVEL_CHECK_MIN_ACTIVE_RATIO) {
            throw createClientError("LOW_VOLUME_OR_SILENCE");
        }
    } catch (error) {
        if (error?.failureCode) {
            throw error;
        }
    } finally {
        await context.close().catch(() => {});
    }
}

// 그림 문항 이미지는 DB 경로나 fallback 파일명을 모두 브라우저용 정적 경로로 맞춰 준다.
function normalizeImagePath(imageFilePath) {
    if (!imageFilePath) {
        return "";
    }

    const normalizedPath = String(imageFilePath).trim().replaceAll("\\", "/");
    if (!normalizedPath) {
        return "";
    }

    if (normalizedPath.startsWith("http://") || normalizedPath.startsWith("https://")) {
        return normalizedPath;
    }

    if (normalizedPath.startsWith("/cognitive-images/")) {
        return normalizedPath;
    }

    const cognitiveImagesMarker = "/cognitive-images/";
    const markerIndex = normalizedPath.indexOf(cognitiveImagesMarker);
    if (markerIndex >= 0) {
        return normalizedPath.substring(markerIndex);
    }

    const trimmedPath = normalizedPath.replace(/^\.?\//, "");
    if (trimmedPath.startsWith("cognitive-images/")) {
        return `/${trimmedPath}`;
    }

    return `/cognitive-images/${trimmedPath.split("/").pop()}`;
}

function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\"", "&quot;")
        .replaceAll("'", "&#39;");
}

function calculateQuestionScore(state, question, timedOut) {
    if (timedOut) {
        return 0;
    }

    const savedFinalScore = state.finalScoresByQuestionId[question.questionId];
    if (typeof savedFinalScore === "number") {
        return savedFinalScore;
    }

    const normalizedTranscript = normalizeScoringText(state.transcriptsByQuestionId[question.questionId]);
    if (!normalizedTranscript) {
        return 0;
    }

    const questionTypeName = String(question.questionTypeName || "");
    const questionText = String(question.questionText || "");
    const criteriaText = String(question.imageDescriptionCriteria || "");

    if (isUnknownOrIrrelevantAnswer(normalizedTranscript)) {
        return 0;
    }

    if (questionTypeName.includes("오늘 날짜")) {
        return scoreDateQuestion(questionText, normalizedTranscript);
    }

    if (questionTypeName.includes("그림 설명")) {
        return scorePictureDescriptionQuestion(normalizedTranscript, criteriaText);
    }

    if (questionTypeName.includes("상황 질문")) {
        return scoreSituationQuestion(questionText, normalizedTranscript);
    }

    if (questionTypeName.includes("규칙 기반 언어추론")) {
        return scoreReasoningQuestion(normalizedTranscript);
    }

    if (questionTypeName.includes("추억 말하기")) {
        return scoreMemoryQuestion(questionText, normalizedTranscript);
    }

    return scoreGenericSpeechQuestion(normalizedTranscript);
}

function calculateAverageScore(scores) {
    if (!scores.length) {
        return 0;
    }

    const totalScore = scores.reduce((sum, currentScore) => sum + currentScore, 0);
    return Math.round((totalScore / scores.length) * 10) / 10;
}

function applyQuestionAnalysisResult(state, questionId, analysisResult) {
    if (!analysisResult) {
        return;
    }

    if (analysisResult.analysisStatus === "FAILED") {
        setQuestionFailure(state, questionId, toFailureInfo(analysisResult));
        return;
    }

    clearQuestionFailure(state, questionId);

    if (typeof analysisResult.finalScore === "number") {
        state.finalScoresByQuestionId[questionId] = analysisResult.finalScore;
    }

    const backendTranscript = String(analysisResult.sttText || "").trim();
    if (backendTranscript) {
        // 브라우저 STT가 비어도 서버 STT 결과는 이후 점수 계산과 확인용 텍스트로 남긴다.
        state.transcriptsByQuestionId[questionId] = backendTranscript;
        state.dbTranscriptsByQuestionId[questionId] = backendTranscript;
    }

    saveTestProgress(state, Boolean(state.completed));
}

function normalizeScoringText(value) {
    return String(value || "")
        .toLowerCase()
        .replaceAll(/[.,!?]/g, " ")
        .replaceAll(/\s+/g, " ")
        .trim();
}

function isUnknownOrIrrelevantAnswer(transcript) {
    return /(모르|몰라|기억 안|잘 모르|어떻게 알아|무응답|싫어|안 할래)/.test(transcript);
}

function scoreDateQuestion(questionText, transcript) {
    const requirements = extractDateRequirements(questionText);
    const fulfilledCount = requirements.filter((requirement) => requirement.matcher.test(transcript)).length;
    const relatedTemporalExpression = /(년|월|일|요일|월요일|화요일|수요일|목요일|금요일|토요일|일요일|봄|여름|가을|겨울|오전|오후|평일|주말|오늘|내일|어제|다음 달|주말)/.test(transcript);

    if (fulfilledCount === 0) {
        return relatedTemporalExpression ? 40 : 0;
    }

    if (requirements.length <= 1) {
        return 100;
    }

    if (requirements.length === 2) {
        if (fulfilledCount === 2) {
            return 100;
        }

        const fulfilledBasic = requirements.some((requirement) => requirement.isBasic && requirement.matcher.test(transcript));
        const fulfilledExtra = requirements.some((requirement) => !requirement.isBasic && requirement.matcher.test(transcript));
        return fulfilledBasic && !fulfilledExtra ? 80 : 60;
    }

    if (fulfilledCount === requirements.length) {
        return 100;
    }

    if (fulfilledCount >= requirements.length - 1) {
        return 80;
    }

    return 60;
}

function extractDateRequirements(questionText) {
    const requirements = [];
    const normalizedQuestion = normalizeScoringText(questionText);

    if (/몇 년|연도|올해/.test(normalizedQuestion)) {
        requirements.push({key: "year", isBasic: true, matcher: /\d{4}|이천|년/});
    }
    if (/몇 월|이번 달|월/.test(normalizedQuestion)) {
        requirements.push({key: "month", isBasic: true, matcher: /\d+\s*월|일월|이월|삼월|사월|오월|유월|육월|칠월|팔월|구월|시월|십월|십일월|십이월/});
    }
    if (/며칠|몇 일|무슨 날|일자|오늘은 며칠/.test(normalizedQuestion)) {
        requirements.push({key: "day", isBasic: true, matcher: /\d+\s*일|하루|이일|삼일|사일|오일|육일|칠일|팔일|구일|십|이십|삼십/});
    }
    if (/요일/.test(normalizedQuestion)) {
        requirements.push({key: "weekday", isBasic: true, matcher: /월요일|화요일|수요일|목요일|금요일|토요일|일요일/});
    }
    if (/계절/.test(normalizedQuestion)) {
        requirements.push({key: "season", isBasic: true, matcher: /봄|여름|가을|겨울/});
    }
    if (/오전|오후/.test(normalizedQuestion)) {
        requirements.push({key: "ampm", isBasic: true, matcher: /오전|오후/});
    }
    if (/평일|주말/.test(normalizedQuestion)) {
        requirements.push({key: "weektype", isBasic: false, matcher: /평일|주말/});
    }
    if (/다음 달/.test(normalizedQuestion)) {
        requirements.push({key: "nextMonth", isBasic: false, matcher: /다음 달|담 달|다음달/});
    }
    if (/내일/.test(normalizedQuestion)) {
        requirements.push({key: "tomorrow", isBasic: false, matcher: /내일/});
    }
    if (/어제/.test(normalizedQuestion)) {
        requirements.push({key: "yesterday", isBasic: false, matcher: /어제/});
    }
    if (/주말까지|며칠 뒤|며칠 전/.test(normalizedQuestion)) {
        requirements.push({key: "relativeDayCount", isBasic: false, matcher: /하루|이틀|사흘|나흘|닷새|엿새|이레|\d+\s*일/});
    }

    return requirements.length
        ? requirements
        : [{key: "genericDate", isBasic: true, matcher: /년|월|일|요일|봄|여름|가을|겨울|오전|오후/}];
}

function scorePictureDescriptionQuestion(transcript, criteriaText) {
    const criteriaKeywords = extractMeaningfulKeywords(criteriaText);
    const matchedKeywordCount = criteriaKeywords.filter((keyword) => transcript.includes(keyword)).length;
    const hasDescriptionVerb = /(있|하네|하네요|보이|달아|고르|걷|도와|읽|밀|꺼내|끓|넘치|떨어뜨|핥|쓰고)/.test(transcript);
    const hasEvaluationOnly = /(좋|멋지|재밌|정신없|바쁘|위험|조용)/.test(transcript) && !hasDescriptionVerb;
    const hasDesireOnly = /(싶다|싶네|싶어요)/.test(transcript) && !hasDescriptionVerb;

    if (matchedKeywordCount >= 3 || (matchedKeywordCount >= 2 && hasDescriptionVerb)) {
        return 100;
    }
    if (matchedKeywordCount >= 2 || (matchedKeywordCount >= 1 && hasDescriptionVerb)) {
        return 80;
    }
    if (matchedKeywordCount >= 1) {
        return 60;
    }
    if (hasEvaluationOnly || hasDesireOnly) {
        return 40;
    }

    return 0;
}

function scoreSituationQuestion(questionText, transcript) {
    const normalizedQuestion = normalizeScoringText(questionText);
    const actionVerbMatched = /(전화|부르|알리|도와|도움|병원|119|신고|물어|찾아|가야|가겠|해야|해야지|해봐야|도망|피하)/.test(transcript);
    const contextMatched = hasQuestionContextKeyword(normalizedQuestion, transcript);

    if (contextMatched && actionVerbMatched) {
        return 100;
    }
    if (actionVerbMatched) {
        return 80;
    }
    if (contextMatched) {
        return 60;
    }
    if (/(조심|위험|큰일|무섭)/.test(transcript)) {
        return 40;
    }

    return 0;
}

function hasQuestionContextKeyword(normalizedQuestion, transcript) {
    const contextGroups = [
        ["물", "수도", "관리실"],
        ["욕실", "미끄", "다쳤", "아프"],
        ["길", "가게", "집", "물어"],
        ["불", "화재", "연기"],
        ["전화", "번호", "계좌"],
        ["병원", "약", "응급"]
    ];

    return contextGroups.some((group) =>
        group.some((keyword) => normalizedQuestion.includes(keyword)) &&
        group.some((keyword) => transcript.includes(keyword))
    );
}

function scoreReasoningQuestion(transcript) {
    if (/(둘 다|둘다|같)/.test(transcript) && transcript.length >= 6) {
        return 100;
    }
    if (/(과일|동물|짐승|탈것|도구|가구|글씨|먹는|쓰는)/.test(transcript)) {
        return 80;
    }
    if (transcript.length >= 4) {
        return 60;
    }
    return 40;
}

function scoreMemoryQuestion(questionText, transcript) {
    const hasPastExperienceMarker = /(했|했어|했지|였|었|살았|다녔|먹었|좋아했|키웠|갔|놀았|기억|생각|적이 있|하곤 했)/.test(transcript);
    const hasCurrentOnlyExpression = /(지금|요즘|좋아요|좋네요|가고 싶|먹고 싶)/.test(transcript) && !hasPastExperienceMarker;
    const hasGenericStatement = /(좋지|중요|해야지|몸에 좋|소중|다 힘들)/.test(transcript) && !hasPastExperienceMarker;
    const questionKeywords = extractMeaningfulKeywords(questionText);
    const matchedTopicKeywordCount = questionKeywords.filter((keyword) => transcript.includes(keyword)).length;

    if (hasPastExperienceMarker && transcript.length >= 20) {
        return 100;
    }
    if (hasPastExperienceMarker) {
        return 80;
    }
    if (matchedTopicKeywordCount >= 1 && hasCurrentOnlyExpression) {
        return 60;
    }
    if (matchedTopicKeywordCount >= 1 && hasGenericStatement) {
        return 40;
    }
    if (matchedTopicKeywordCount >= 1) {
        return 60;
    }

    return 0;
}

function scoreGenericSpeechQuestion(transcript) {
    if (transcript.length >= 20) {
        return 100;
    }
    if (transcript.length >= 10) {
        return 80;
    }
    if (transcript.length >= 4) {
        return 60;
    }
    return 40;
}

function extractMeaningfulKeywords(text) {
    const stopwords = new Set([
        "그림", "장면", "설명", "말씀", "주세요", "그리고", "입니다", "있는", "하는", "어떤", "무슨", "지금",
        "오늘", "대한", "때", "어릴", "학교", "친구", "기억", "남는", "보고", "인가요", "해주세요"
    ]);

    return Array.from(new Set(
        String(text || "")
            .replaceAll(/[.,!?()]/g, " ")
            .split(/\s+/)
            .map((token) => token.trim())
            .filter((token) => token.length >= 2 && !stopwords.has(token))
    ));
}
