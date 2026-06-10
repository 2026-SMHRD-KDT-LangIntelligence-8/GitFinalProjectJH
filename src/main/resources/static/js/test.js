const TEST_DURATION_SECONDS = 70;
const TEST_PROGRESS_STORAGE_KEY = "latestCognitiveTestProgress";
const DEFAULT_AUDIO_FILE_NAME = "answer.webm";
const SpeechRecognitionConstructor = window.SpeechRecognition || window.webkitSpeechRecognition;

document.addEventListener("DOMContentLoaded", async () => {
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
    const nextQuestionButton = document.getElementById("next-question-btn");
    const voiceBadge = document.getElementById("question-voice-badge");
    const voiceGuide = document.getElementById("question-voice-guide");
    const voiceTranscript = document.getElementById("question-voice-transcript");
    const voiceReviewToggleButton = document.getElementById("voice-review-toggle-btn");
    const voiceReviewText = document.getElementById("voice-review-text");

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
        transcriptsByQuestionId: {},
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
        voiceReviewExpanded: false
    };

    setVoiceState("idle");

    try {
        await loadRecipients(recipientSelect);
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
            state.transcriptsByQuestionId = {};

            saveTestProgress(state);

            introView.classList.add("hidden");
            sessionView.classList.remove("hidden");
            recipientNameChip.textContent = `${payload.recipientName} 검사`;
            nextQuestionButton.disabled = true;
            timerStartButton.disabled = false;

            renderCurrentQuestion();
        } catch (error) {
            console.error(error);
            alert("검사 문항을 불러오지 못했습니다.");
            startButton.disabled = false;
        }
    });

    timerStartButton.addEventListener("click", async () => {
        timerStartButton.disabled = true;
        nextQuestionButton.disabled = false;
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

    nextQuestionButton.addEventListener("click", async () => {
        await moveToNextQuestion(false);
    });

    voiceReviewToggleButton.addEventListener("click", () => {
        state.voiceReviewExpanded = !state.voiceReviewExpanded;
        renderVoiceReview(state.questions[state.currentIndex]?.questionId);
    });

    window.addEventListener("beforeunload", () => {
        stopVoiceRecognition();
        stopVoicePulse();
        releaseMediaStream(state);
        if (state.questions.length > 0) {
            saveTestProgress(state);
        }
    });

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

    async function moveToNextQuestion(timedOut) {
        const currentQuestion = state.questions[state.currentIndex];
        if (!currentQuestion) {
            return;
        }

        clearQuestionTimer();
        stopVoiceRecognition();
        stopVoicePulse();
        await stopRecordingAndUpload(state, currentQuestion);
        state.timerStarted = false;
        markQuestionCompleted(currentQuestion.questionId, timedOut);

        if (state.currentIndex >= state.questions.length - 1) {
            await finishTest();
            return;
        }

        state.currentIndex += 1;
        state.remainingSeconds = state.questionDurationSeconds;
        timerStartButton.disabled = false;
        nextQuestionButton.disabled = true;
        renderCurrentQuestion();
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

    async function finishTest() {
        nextQuestionButton.disabled = true;
        timerStartButton.disabled = true;
        stopVoiceRecognition();
        stopVoicePulse();
        releaseMediaStream(state);
        saveTestProgress(state, true);

        await completeTest(state.recipientId);
        sessionStorage.removeItem(TEST_PROGRESS_STORAGE_KEY);

        alert("인지능력 검사가 완료되었습니다.");
        window.location.href = "/test";
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
        state.voiceReviewExpanded = false;
        voiceTranscript.textContent = "";
        voiceTranscript.classList.remove("is-listening");
        voiceTranscript.style.setProperty("--voice-pulse-scale", "1");
        voiceTranscript.style.setProperty("--voice-pulse-shadow", "6px");
    }

    function renderVoiceReview(questionId) {
        const transcript = state.transcriptsByQuestionId[questionId]?.trim() || "";
        const hasTranscript = Boolean(transcript);

        voiceReviewToggleButton.disabled = !hasTranscript;
        voiceReviewToggleButton.textContent = hasTranscript
            ? `인식된 텍스트 확인 ${state.voiceReviewExpanded ? "접기" : "펼치기"}`
            : "인식된 텍스트 확인 펼치기";

        if (!hasTranscript || !state.voiceReviewExpanded) {
            voiceReviewText.classList.add("hidden");
            voiceReviewText.textContent = "";
            return;
        }

        voiceReviewText.textContent = transcript;
        voiceReviewText.classList.remove("hidden");
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
        return;
    }

    await uploadQuestionAudio(state.performanceId, question.questionId, audioBlob);
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
        throw new Error("question_audio_upload_failed");
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
        const transcript = state.transcriptsByQuestionId[question.questionId];
        const timedOut = state.timedOutQuestionIds.includes(question.questionId);
        const questionScore = calculateQuestionScore(question, transcript, timedOut);

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
        questionTypeScores,
        transcriptsByQuestionId: {...state.transcriptsByQuestionId},
        questions: state.questions.map((question) => ({
            questionId: question.questionId,
            questionTypeId: question.questionTypeId,
            questionTypeName: question.questionTypeName
        }))
    };

    sessionStorage.setItem(TEST_PROGRESS_STORAGE_KEY, JSON.stringify(summary));
}

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

    if (normalizedPath.startsWith("/")) {
        return normalizedPath;
    }

    return `/cognitive-images/${normalizedPath.replace(/^\.?\//, "")}`;
}

function calculateQuestionScore(question, transcript, timedOut) {
    if (timedOut) {
        return 0;
    }

    const normalizedTranscript = normalizeScoringText(transcript);
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
