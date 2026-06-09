const TRAINING_SESSION_STORAGE_KEY = "trainingStartPayload";
const TEST_PROGRESS_STORAGE_KEY = "latestCognitiveTestProgress";
const TRAINING_AUDIO_FILE_NAME = "training-answer.webm";

document.addEventListener("DOMContentLoaded", () => {
    const payloadText = sessionStorage.getItem(TRAINING_SESSION_STORAGE_KEY);
    const testProgressText = sessionStorage.getItem(TEST_PROGRESS_STORAGE_KEY);
    const trainingList = document.getElementById("training-list");
    const trainingRecipient = document.getElementById("training-recipient");

    if (!payloadText) {
        trainingList.innerHTML = "<p class=\"question-purpose\">훈련 데이터를 먼저 불러와 주세요.</p>";
        return;
    }

    const payload = JSON.parse(payloadText);
    const testProgress = testProgressText ? JSON.parse(testProgressText) : null;
    trainingRecipient.textContent = `${payload.recipientName} 수급자`;

    if (!testProgress || testProgress.recipientId !== payload.recipientId) {
        trainingList.innerHTML = "<p class=\"question-purpose\">같은 수급자의 검사 기록이 없어 훈련 항목을 고를 수 없습니다.</p>";
        return;
    }

    const weakTypeIdSet = new Set(testProgress.weakTypeIds || []);
    const weakPrograms = new Map();

    payload.questions.forEach((question) => {
        if (weakTypeIdSet.has(question.questionTypeId) && !weakPrograms.has(question.questionTypeId)) {
            weakPrograms.set(question.questionTypeId, question);
        }
    });

    if (weakPrograms.size === 0) {
        trainingList.innerHTML = "<p class=\"question-purpose\">검사에서 추가 훈련이 필요한 항목이 없습니다.</p>";
        return;
    }

    renderTrainingProgramList(trainingList, payload, weakPrograms);
});

function renderTrainingProgramList(trainingList, payload, weakPrograms) {
    trainingList.innerHTML = "";

    weakPrograms.forEach((question) => {
        const item = document.createElement("a");
        item.href = "#";
        item.className = "training-item";

        item.innerHTML = `
            <span class="training-text">${escapeHtml(question.questionTypeName)}</span>
            <div class="arrow-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>
        `;

        item.addEventListener("click", async (event) => {
            event.preventDefault();
            await renderTrainingQuestionSession(trainingList, payload, weakPrograms, question.questionTypeId);
        });

        trainingList.appendChild(item);
    });
}

async function renderTrainingQuestionSession(trainingList, payload, weakPrograms, selectedTypeId) {
    const selectedQuestions = payload.questions.filter((question) => question.questionTypeId === selectedTypeId);
    if (selectedQuestions.length === 0) {
        trainingList.innerHTML = "<p class=\"question-purpose\">선택한 훈련 문항을 찾지 못했습니다.</p>";
        return;
    }

    let currentIndex = 0;
    const recordingState = {
        mediaStream: null,
        mediaRecorder: null,
        recordedChunks: [],
        recordingStarted: false
    };

    trainingList.innerHTML = `
        <div class="test-question-card" id="training-question-card">
            <div class="question-meta-row">
                <span class="question-type-badge" id="training-type-name"></span>
                <span class="question-sequence-text" id="training-progress-text"></span>
            </div>
            <p class="question-text" id="training-question-text"></p>
            <div class="question-image-wrap hidden" id="training-image-wrap">
                <img class="question-image" id="training-image" alt="훈련 문항 이미지">
            </div>
            <div class="question-voice-panel">
                <div class="question-voice-header">
                    <span class="question-voice-badge" id="training-voice-badge">음성 대기</span>
                    <span class="question-voice-guide" id="training-voice-guide">훈련 시작을 누르면 문항별 음성이 저장됩니다.</span>
                </div>
            </div>
        </div>
        <div class="test-session-actions">
            <button type="button" class="timer-start-btn" id="training-list-button">목록으로</button>
            <button type="button" class="timer-start-btn" id="training-start-button">훈련 시작</button>
            <button type="button" class="next-question-btn" id="training-next-button" disabled>다음 문제</button>
        </div>
    `;

    const typeNameElement = document.getElementById("training-type-name");
    const progressTextElement = document.getElementById("training-progress-text");
    const questionTextElement = document.getElementById("training-question-text");
    const imageWrapElement = document.getElementById("training-image-wrap");
    const imageElement = document.getElementById("training-image");
    const listButton = document.getElementById("training-list-button");
    const startButton = document.getElementById("training-start-button");
    const nextButton = document.getElementById("training-next-button");
    const voiceBadge = document.getElementById("training-voice-badge");
    const voiceGuide = document.getElementById("training-voice-guide");

    listButton.addEventListener("click", async () => {
        await stopTrainingRecordingAndUpload(recordingState, payload.performanceId, selectedQuestions[currentIndex]);
        releaseTrainingMediaStream(recordingState);
        renderTrainingProgramList(trainingList, payload, weakPrograms);
    });

    startButton.addEventListener("click", async () => {
        startButton.disabled = true;
        nextButton.disabled = false;

        try {
            await ensureTrainingMicrophoneReady(recordingState);
            startTrainingRecording(recordingState);
            recordingState.recordingStarted = true;
            setTrainingVoiceState("listening", voiceBadge, voiceGuide);
        } catch (error) {
            console.error(error);
            startButton.disabled = false;
            setTrainingVoiceState("error", voiceBadge, voiceGuide, "마이크 권한을 허용해야 훈련 음성을 저장할 수 있습니다.");
        }
    });

    nextButton.addEventListener("click", async () => {
        await stopTrainingRecordingAndUpload(recordingState, payload.performanceId, selectedQuestions[currentIndex]);

        if (currentIndex >= selectedQuestions.length - 1) {
            releaseTrainingMediaStream(recordingState);
            renderTrainingProgramList(trainingList, payload, weakPrograms);
            return;
        }

        currentIndex += 1;
        recordingState.recordingStarted = false;
        startButton.disabled = false;
        nextButton.disabled = true;
        setTrainingVoiceState("idle", voiceBadge, voiceGuide);
        renderTrainingQuestion();
    });

    renderTrainingQuestion();

    function renderTrainingQuestion() {
        const currentQuestion = selectedQuestions[currentIndex];
        typeNameElement.textContent = currentQuestion.questionTypeName;
        progressTextElement.textContent = `${currentIndex + 1} / ${selectedQuestions.length}`;
        progressTextElement.classList.remove("hidden");
        questionTextElement.textContent = currentQuestion.questionText;

        const normalizedImagePath = normalizeImagePath(currentQuestion.imageFilePath);
        if (normalizedImagePath) {
            imageElement.src = normalizedImagePath;
            imageWrapElement.classList.remove("hidden");
        } else {
            imageElement.removeAttribute("src");
            imageWrapElement.classList.add("hidden");
        }

        nextButton.textContent = currentIndex >= selectedQuestions.length - 1 ? "훈련 종료" : "다음 문제";
    }
}

async function ensureTrainingMicrophoneReady(recordingState) {
    if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("microphone_not_supported");
    }

    if (recordingState.mediaStream) {
        return recordingState.mediaStream;
    }

    recordingState.mediaStream = await navigator.mediaDevices.getUserMedia({audio: true});
    return recordingState.mediaStream;
}

function startTrainingRecording(recordingState) {
    if (!recordingState.mediaStream) {
        return;
    }

    recordingState.recordedChunks = [];
    const mediaRecorder = new MediaRecorder(recordingState.mediaStream);

    mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
            recordingState.recordedChunks.push(event.data);
        }
    };

    recordingState.mediaRecorder = mediaRecorder;
    mediaRecorder.start();
}

async function stopTrainingRecordingAndUpload(recordingState, performanceId, question) {
    if (!recordingState.mediaRecorder || recordingState.mediaRecorder.state === "inactive") {
        return;
    }

    const audioBlob = await new Promise((resolve) => {
        recordingState.mediaRecorder.onstop = () => {
            resolve(new Blob(recordingState.recordedChunks, {
                type: recordingState.mediaRecorder.mimeType || "audio/webm"
            }));
        };
        recordingState.mediaRecorder.stop();
    });

    recordingState.mediaRecorder = null;
    recordingState.recordedChunks = [];

    if (!audioBlob || audioBlob.size === 0) {
        return;
    }

    await uploadTrainingQuestionAudio(performanceId, question.questionId, audioBlob);
}

function releaseTrainingMediaStream(recordingState) {
    if (!recordingState.mediaStream) {
        return;
    }

    recordingState.mediaStream.getTracks().forEach((track) => track.stop());
    recordingState.mediaStream = null;
}

async function uploadTrainingQuestionAudio(performanceId, questionId, audioBlob) {
    const formData = new FormData();
    formData.append("performanceId", String(performanceId));
    formData.append("questionId", String(questionId));
    formData.append("audioFile", audioBlob, TRAINING_AUDIO_FILE_NAME);

    const response = await fetch("/api/cognitive-tests/question-results", {
        method: "POST",
        body: formData
    });

    if (!response.ok) {
        throw new Error("training_question_audio_upload_failed");
    }

    return response.json();
}

function setTrainingVoiceState(mode, voiceBadge, voiceGuide, customMessage) {
    voiceBadge.classList.remove("is-listening", "is-error");

    if (mode === "listening") {
        voiceBadge.classList.add("is-listening");
        voiceBadge.textContent = "녹음 중";
        voiceGuide.textContent = customMessage || "현재 문항의 답변 음성이 저장됩니다.";
        return;
    }

    if (mode === "error") {
        voiceBadge.classList.add("is-error");
        voiceBadge.textContent = "음성 저장 안내";
        voiceGuide.textContent = customMessage || "현재 기기에서는 음성 저장을 사용할 수 없습니다.";
        return;
    }

    voiceBadge.textContent = "음성 대기";
    voiceGuide.textContent = customMessage || "훈련 시작을 누르면 문항별 음성이 저장됩니다.";
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

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\"", "&quot;")
        .replaceAll("'", "&#39;");
}
