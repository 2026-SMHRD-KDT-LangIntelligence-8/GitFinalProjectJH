const TRAINING_SESSION_STORAGE_KEY = "trainingStartPayload";
const TRAINING_AUDIO_FILE_NAME = "training-answer.webm";
const TRAINING_DURATION_SECONDS = 70;
const TRAINING_RESULT_POLL_INTERVAL_MS = 1500;

const TRAINING_DIRECTION_BY_TYPE = {
    "오늘 날짜 말하기": "달력이나 휴대폰 날짜를 함께 보며 오늘의 연도, 월, 일, 요일을 소리 내어 말하는 연습을 반복해 주세요.",
    "그림 설명하기": "그림 속 인물, 장소, 행동을 순서대로 나누어 말하고 짧은 문장을 길게 확장하는 방식으로 설명 연습을 해 주세요.",
    "상황 질문 답하기": "일상 상황을 하나씩 제시한 뒤 해야 할 행동을 차분히 한 문장 이상으로 답하는 연습을 해 주세요.",
    "규칙 기반 언어추론": "공통점 찾기, 분류하기, 이유 설명하기 문제를 짧게라도 꾸준히 풀면서 생각한 근거를 함께 말해 보게 해 주세요.",
    "추억 말하기": "최근 일이나 익숙한 옛일을 시간 순서대로 떠올려 말하고, 장소와 사람 이름을 함께 덧붙이는 연습을 해 주세요."
};

document.addEventListener("DOMContentLoaded", async () => {
    const params = new URLSearchParams(window.location.search);
    const queryRecipientId = params.get("recipientId");
    const selectedQuestionTypeName = params.get("questionTypeName");
    const trainingList = document.getElementById("training-list");
    const trainingRecipient = document.getElementById("training-recipient");
    const backButton = document.querySelector(".back-btn");
    let activeSessionBackHandler = null;

    const payload = await resolveTrainingPayload(queryRecipientId);

    if (!payload) {
        trainingList.innerHTML = "<p class=\"question-purpose\">훈련 데이터를 먼저 불러와 주세요.</p>";
        return;
    }

    trainingRecipient.textContent = `${payload.recipientName} 수급자`;

    const weakTypeNameSet = new Set((payload.weakQuestionTypeNames || []).filter(Boolean));
    const weakPrograms = new Map();
    const hasWeakType = weakTypeNameSet.size > 0;

    payload.questions.forEach((question) => {
        const matchedWeakType = hasWeakType && weakTypeNameSet.has(question.questionTypeName);
        const matchedSelectedType = !selectedQuestionTypeName || question.questionTypeName === selectedQuestionTypeName;

        if (matchedWeakType && matchedSelectedType && !weakPrograms.has(question.questionTypeName)) {
            weakPrograms.set(question.questionTypeName, question);
        }
    });

    if (weakPrograms.size === 0) {
        trainingList.innerHTML = selectedQuestionTypeName
            ? `<p class="question-purpose">${escapeHtml(selectedQuestionTypeName)} 유형은 현재 추가 훈련 대상이 아닙니다.</p>`
            : "<p class=\"question-purpose\">해당 수급자는 인지능력 검사 결과 안정권이므로 훈련이 필요하지 않습니다.</p>";
        return;
    }

    const renderTrainingListView = () => {
        activeSessionBackHandler = null;
        renderTrainingProgramList(trainingList, weakPrograms, async (questionTypeName) => {
            activeSessionBackHandler = await renderTrainingQuestionSession(
                trainingList,
                payload,
                questionTypeName,
                () => {
                    activeSessionBackHandler = async () => {
                        renderTrainingListView();
                    };
                    renderTrainingReviewView(
                        trainingList,
                        questionTypeName,
                        payload.questions.filter((question) => question.questionTypeName === questionTypeName),
                        payload.performanceId,
                        renderTrainingListView
                    );
                },
                renderTrainingListView
            );
        });
    };

    backButton?.addEventListener("click", async (event) => {
        if (!activeSessionBackHandler) {
            return;
        }

        event.preventDefault();
        const backHandler = activeSessionBackHandler;
        activeSessionBackHandler = null;
        await backHandler();
    });

    renderTrainingListView();
});

async function resolveTrainingPayload(queryRecipientId) {
    const payloadText = sessionStorage.getItem(TRAINING_SESSION_STORAGE_KEY);
    if (payloadText) {
        const storedPayload = JSON.parse(payloadText);
        if (!queryRecipientId || String(storedPayload.recipientId) === String(queryRecipientId)) {
            return storedPayload;
        }
    }

    if (!queryRecipientId) {
        return null;
    }

    const response = await fetch("/api/cognitive-tests/training/start", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            recipientId: Number(queryRecipientId)
        })
    });

    if (!response.ok) {
        throw new Error("training_start_failed");
    }

    const payload = await response.json();
    sessionStorage.setItem(TRAINING_SESSION_STORAGE_KEY, JSON.stringify(payload));
    return payload;
}

function renderTrainingProgramList(trainingList, weakPrograms, onSelectQuestionType) {
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
            await onSelectQuestionType(question.questionTypeName);
        });

        trainingList.appendChild(item);
    });
}

async function renderTrainingQuestionSession(trainingList, payload, selectedTypeName, onSessionCompleted, onSessionCanceled) {
    const selectedQuestions = payload.questions.filter((question) => question.questionTypeName === selectedTypeName);
    if (selectedQuestions.length === 0) {
        trainingList.innerHTML = "<p class=\"question-purpose\">선택한 훈련 문항을 찾지 못했습니다.</p>";
        return null;
    }

    let currentIndex = 0;
    const recordingState = {
        mediaStream: null,
        mediaRecorder: null,
        recordedChunks: [],
        recordingStarted: false,
        audioContext: null,
        voiceAnalyser: null,
        voiceSource: null,
        voiceDataArray: null,
        voiceAnimationId: null,
        timerId: null,
        remainingSeconds: TRAINING_DURATION_SECONDS,
        questionAdvancePending: false,
        uploadedQuestionResultIdsByQuestionId: {}
    };

    trainingList.innerHTML = `
        <div class="test-timer-card">
            <span class="timer-label">남은 시간</span>
            <strong class="timer-value" id="training-question-timer">01:10</strong>
        </div>
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
                    <span class="question-voice-guide" id="training-voice-guide">훈련 시작을 누르면 문항별 음성이 자동으로 저장됩니다.</span>
                </div>
                <div class="question-voice-transcript" id="training-voice-transcript"></div>
            </div>
        </div>
        <div class="test-session-actions">
            <button type="button" class="timer-start-btn" id="training-start-button">훈련 시작</button>
        </div>
    `;

    const typeNameElement = document.getElementById("training-type-name");
    const progressTextElement = document.getElementById("training-progress-text");
    const questionTextElement = document.getElementById("training-question-text");
    const imageWrapElement = document.getElementById("training-image-wrap");
    const imageElement = document.getElementById("training-image");
    const timerElement = document.getElementById("training-question-timer");
    const startButton = document.getElementById("training-start-button");
    const voiceBadge = document.getElementById("training-voice-badge");
    const voiceGuide = document.getElementById("training-voice-guide");
    const voiceTranscript = document.getElementById("training-voice-transcript");

    startButton.addEventListener("click", async () => {
        if (recordingState.recordingStarted) {
            await moveToNextTrainingQuestion(false);
            return;
        }

        startButton.disabled = true;
        startButton.textContent = "넘어가기";
        recordingState.recordingStarted = true;
        runTrainingQuestionTimer();

        try {
            await ensureTrainingMicrophoneReady(recordingState);
            startTrainingRecording(recordingState);
            startTrainingVoicePulse(recordingState, voiceTranscript);
            startButton.disabled = false;
            setTrainingVoiceState("listening", voiceBadge, voiceGuide);
        } catch (error) {
            console.error(error);
            clearTrainingQuestionTimer();
            recordingState.recordingStarted = false;
            recordingState.remainingSeconds = TRAINING_DURATION_SECONDS;
            updateTrainingTimerText();
            startButton.disabled = false;
            startButton.textContent = "훈련 시작";
            resetTrainingVoicePulse(voiceTranscript);
            setTrainingVoiceState("error", voiceBadge, voiceGuide, "마이크 권한을 허용해야 훈련 음성을 저장할 수 있습니다.");
        }
    });

    renderTrainingQuestion();

    async function moveToNextTrainingQuestion(timedOut) {
        const currentQuestion = selectedQuestions[currentIndex];
        if (!currentQuestion || recordingState.questionAdvancePending) {
            return;
        }

        recordingState.questionAdvancePending = true;
        startButton.disabled = true;
        startButton.textContent = "정리 중...";
        clearTrainingQuestionTimer();

        try {
            const uploadResult = await stopTrainingRecordingAndUpload(recordingState, payload.performanceId, currentQuestion, voiceTranscript);
            if (uploadResult?.questionResultId) {
                recordingState.uploadedQuestionResultIdsByQuestionId[currentQuestion.questionId] = uploadResult.questionResultId;
            }
        } catch (error) {
            console.error(error);
        } finally {
            recordingState.questionAdvancePending = false;
        }

        recordingState.recordingStarted = false;

        if (currentIndex >= selectedQuestions.length - 1) {
            releaseTrainingMediaStream(recordingState, voiceTranscript);
            onSessionCompleted?.({
                uploadedQuestionResultIdsByQuestionId: {...recordingState.uploadedQuestionResultIdsByQuestionId}
            });
            return;
        }

        currentIndex += 1;
        recordingState.remainingSeconds = TRAINING_DURATION_SECONDS;
        startButton.textContent = "훈련 시작";
        startButton.disabled = false;
        setTrainingVoiceState("idle", voiceBadge, voiceGuide, timedOut ? "시간이 종료되어 다음 문항으로 이동했습니다." : undefined);
        resetTrainingVoicePulse(voiceTranscript);
        renderTrainingQuestion();
    }

    function runTrainingQuestionTimer() {
        clearTrainingQuestionTimer();
        updateTrainingTimerText();

        recordingState.timerId = window.setInterval(() => {
            recordingState.remainingSeconds -= 1;
            updateTrainingTimerText();

            if (recordingState.remainingSeconds <= 0) {
                clearTrainingQuestionTimer();
                moveToNextTrainingQuestion(true).catch((error) => {
                    console.error(error);
                });
            }
        }, 1000);
    }

    function clearTrainingQuestionTimer() {
        if (recordingState.timerId !== null) {
            window.clearInterval(recordingState.timerId);
            recordingState.timerId = null;
        }
    }

    function updateTrainingTimerText() {
        const safeSeconds = Math.max(recordingState.remainingSeconds, 0);
        const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, "0");
        const seconds = String(safeSeconds % 60).padStart(2, "0");
        timerElement.textContent = `${minutes}:${seconds}`;
    }

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

        updateTrainingTimerText();
        resetTrainingVoicePulse(voiceTranscript);
    }

    return async () => {
        const currentQuestion = selectedQuestions[currentIndex];
        clearTrainingQuestionTimer();

        if (currentQuestion) {
            try {
                const uploadResult = await stopTrainingRecordingAndUpload(recordingState, payload.performanceId, currentQuestion, voiceTranscript);
                if (uploadResult?.questionResultId) {
                    recordingState.uploadedQuestionResultIdsByQuestionId[currentQuestion.questionId] = uploadResult.questionResultId;
                }
            } catch (error) {
                console.error(error);
            }
        }

        recordingState.recordingStarted = false;
        releaseTrainingMediaStream(recordingState, voiceTranscript);
        onSessionCanceled?.();
    };
}

function renderTrainingReviewView(trainingList, selectedTypeName, selectedQuestions, performanceId, onClose) {
    trainingList.innerHTML = `
        <div class="test-review-card training-result-card">
            <div class="voice-review-header">
                <strong class="voice-review-title">${escapeHtml(selectedTypeName)} 훈련 내용 확인</strong>
                <span class="voice-review-caption">서버에 저장된 답변부터 차례대로 확인할 수 있습니다.</span>
            </div>
            <div class="test-review-status" id="training-review-status">서버에 저장된 훈련 답변 텍스트를 확인하는 중입니다.</div>
            <div class="test-review-list" id="training-review-list"></div>
            <div id="training-result-summary-container"></div>
        </div>
        <div class="test-session-actions">
            <button type="button" class="timer-start-btn" id="training-result-close-btn">다른 훈련 보기</button>
        </div>
    `;

    const reviewStatus = document.getElementById("training-review-status");
    const reviewList = document.getElementById("training-review-list");
    const resultContainer = document.getElementById("training-result-summary-container");
    const closeButton = document.getElementById("training-result-close-btn");
    const selectedQuestionIds = new Set(selectedQuestions.map((question) => Number(question.questionId)));
    let pollingTimerId = null;

    closeButton?.addEventListener("click", () => {
        if (pollingTimerId !== null) {
            window.clearInterval(pollingTimerId);
            pollingTimerId = null;
        }
        onClose?.();
    });

    const renderReviewItems = (results) => {
        const resultMap = new Map(results.map((result) => [Number(result.questionId), result]));
        reviewList.innerHTML = selectedQuestions.map((question, index) => {
            const result = resultMap.get(Number(question.questionId));
            const analysisStatus = String(result?.analysisStatus || "");
            const transcript = String(result?.sttText || "").trim();
            const content = analysisStatus === "FAILED"
                ? '<div class="test-review-pending">텍스트 변환에 실패했습니다. 다시 훈련해 주세요.</div>'
                : transcript
                    ? `
                        <div class="test-review-transcript-header">
                            <span class="test-review-saved-badge">서버 저장 완료</span>
                        </div>
                        <div class="test-review-transcript">${escapeHtml(transcript)}</div>
                    `
                    : '<div class="test-review-pending">서버에서 음성 데이터를 텍스트로 변환중입니다. 잠시만 기다려주세요.</div>';

            return `
                <div class="test-review-item">
                    <div class="test-review-question">${index + 1}. ${escapeHtml(question.questionText)}</div>
                    ${content}
                </div>
            `;
        }).join("");
    };

    const updateReview = async () => {
        const allResults = await fetchTrainingQuestionResults(performanceId);
        const filteredResults = allResults.filter((result) => selectedQuestionIds.has(Number(result.questionId)));
        renderReviewItems(filteredResults);

        const pendingCount = selectedQuestions.filter((question) => {
            const result = filteredResults.find((item) => Number(item.questionId) === Number(question.questionId));
            if (!result) {
                return true;
            }

            return !["COMPLETED", "FAILED"].includes(String(result.analysisStatus || ""));
        }).length;

        if (pendingCount > 0) {
            reviewStatus.classList.remove("is-complete", "is-error");
            reviewStatus.textContent = `남은 ${pendingCount}건의 훈련 답변 텍스트를 서버에서 확인 중입니다.`;
            return false;
        }

        const failedCount = filteredResults.filter((result) => String(result.analysisStatus || "") === "FAILED").length;
        if (failedCount > 0) {
            reviewStatus.classList.remove("is-complete");
            reviewStatus.classList.add("is-error");
            reviewStatus.textContent = `훈련 답변 ${failedCount}건은 텍스트 변환에 실패했습니다. 나머지 결과는 아래에서 확인할 수 있습니다.`;
        } else {
            reviewStatus.classList.remove("is-error");
            reviewStatus.classList.add("is-complete");
            reviewStatus.textContent = "모든 훈련 답변의 서버 저장 텍스트 확인이 완료되었습니다.";
        }

        const resultSummary = buildTrainingResultSummaryFromResults(selectedTypeName, filteredResults);
        renderTrainingResultView(resultContainer, resultSummary);
        return true;
    };

    updateReview()
        .then((completed) => {
            if (completed) {
                return;
            }

            pollingTimerId = window.setInterval(() => {
                updateReview()
                    .then((done) => {
                        if (done && pollingTimerId !== null) {
                            window.clearInterval(pollingTimerId);
                            pollingTimerId = null;
                        }
                    })
                    .catch((error) => {
                        console.error(error);
                        reviewStatus.classList.remove("is-complete");
                        reviewStatus.classList.add("is-error");
                        reviewStatus.textContent = "훈련 답변 텍스트를 다시 불러오는 중 문제가 발생했습니다. 잠시 후 다시 확인해 주세요.";
                    });
            }, TRAINING_RESULT_POLL_INTERVAL_MS);
        })
        .catch((error) => {
            console.error(error);
            reviewStatus.classList.remove("is-complete");
            reviewStatus.classList.add("is-error");
            reviewStatus.textContent = "훈련 답변 텍스트를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.";
        });
}

function renderTrainingResultView(container, resultSummary) {
    if (!container) {
        return;
    }

    const statusBadgeClass = resultSummary.trainingNeeded ? "is-training-needed" : "is-stable";
    const statusLabel = resultSummary.trainingNeeded ? "훈련 필요" : "안정";
    const directionText = resultSummary.trainingNeeded
        ? resultSummary.directionText
        : "현재 점수는 안정권입니다. 지금처럼 같은 유형의 대화와 말하기 활동을 가볍게 유지해 주세요.";

    container.innerHTML = `
        <div class="training-result-summary-card">
            <div class="voice-review-header">
                <strong class="voice-review-title">${escapeHtml(resultSummary.questionTypeName)} 훈련 결과</strong>
                <span class="voice-review-caption">서버에 저장된 훈련 답변을 기준으로 점수와 훈련 방향을 정리했습니다.</span>
            </div>
            <div class="report-type-summary">
                <div class="report-type-summary-item">
                    <span class="report-type-name">평균 점수 ${formatScore(resultSummary.averageScore)}점</span>
                    <div class="report-type-meta">
                        <span class="report-type-badge ${statusBadgeClass}">${statusLabel}</span>
                    </div>
                </div>
            </div>
            <div class="training-result-direction ${resultSummary.trainingNeeded ? "is-training-needed" : "is-stable"}">
                <strong class="training-result-direction-title">${resultSummary.trainingNeeded ? "훈련 방향" : "유지 방향"}</strong>
                <p class="training-result-direction-text">${escapeHtml(directionText)}</p>
            </div>
            <div class="training-result-note">${escapeHtml(resultSummary.noteText)}</div>
        </div>
    `;
}

function buildTrainingResultSummaryFromResults(selectedTypeName, filteredResults) {
    const numericScores = filteredResults
        .map((result) => toTrainingNumericScore(result))
        .filter((score) => typeof score === "number" && !Number.isNaN(score));

    const averageScore = numericScores.length
        ? numericScores.reduce((sum, score) => sum + score, 0) / numericScores.length
        : 0;

    const trainingNeeded = averageScore < 60;
    const completedCount = filteredResults.filter((result) => result.analysisStatus === "COMPLETED").length;
    const failedCount = filteredResults.filter((result) => result.analysisStatus === "FAILED").length;

    return {
        questionTypeName: selectedTypeName,
        averageScore,
        trainingNeeded,
        directionText: getTrainingDirectionText(selectedTypeName),
        noteText: failedCount > 0
            ? `일부 문항은 분석에 실패해 완료 ${completedCount}건, 실패 ${failedCount}건 기준으로 결과를 표시했습니다.`
            : "훈련이 끝난 직후 결과를 확인할 수 있도록 서버 저장 답변 기준 점수를 표시했습니다."
    };
}

async function fetchTrainingQuestionResults(performanceId) {
    const response = await fetch(`/api/cognitive-tests/${performanceId}/question-results`);
    if (!response.ok) {
        throw new Error("training_result_fetch_failed");
    }

    return response.json();
}

function toTrainingNumericScore(result) {
    if (typeof result?.finalScore === "number" && !Number.isNaN(result.finalScore)) {
        return Number(result.finalScore);
    }

    if (typeof result?.appropriatenessScore === "number" && !Number.isNaN(result.appropriatenessScore)) {
        return Number(result.appropriatenessScore);
    }

    return 0;
}

function getTrainingDirectionText(questionTypeName) {
    return TRAINING_DIRECTION_BY_TYPE[questionTypeName]
        || "같은 유형의 질문을 짧게 나누어 반복하고, 답을 한 문장 이상으로 이어서 말하는 연습을 꾸준히 진행해 주세요.";
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

function startTrainingVoicePulse(recordingState, voiceTranscript) {
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor || !recordingState.mediaStream || recordingState.voiceAnimationId || !voiceTranscript) {
        return;
    }

    recordingState.audioContext = recordingState.audioContext || new AudioContextConstructor();
    if (recordingState.audioContext.state === "suspended") {
        recordingState.audioContext.resume().catch((error) => console.error(error));
    }

    recordingState.voiceAnalyser = recordingState.audioContext.createAnalyser();
    recordingState.voiceAnalyser.fftSize = 256;
    recordingState.voiceAnalyser.smoothingTimeConstant = 0.72;
    recordingState.voiceSource = recordingState.audioContext.createMediaStreamSource(recordingState.mediaStream);
    recordingState.voiceSource.connect(recordingState.voiceAnalyser);
    recordingState.voiceDataArray = new Uint8Array(recordingState.voiceAnalyser.fftSize);
    voiceTranscript.classList.add("is-listening");

    const updatePulse = () => {
        recordingState.voiceAnalyser.getByteTimeDomainData(recordingState.voiceDataArray);

        let sum = 0;
        for (const value of recordingState.voiceDataArray) {
            const normalized = (value - 128) / 128;
            sum += normalized * normalized;
        }

        const volume = Math.min(Math.sqrt(sum / recordingState.voiceDataArray.length) * 7, 1);
        const scale = 1 + volume * 1.7;
        const shadow = 6 + volume * 26;
        voiceTranscript.style.setProperty("--voice-pulse-scale", scale.toFixed(2));
        voiceTranscript.style.setProperty("--voice-pulse-shadow", `${shadow.toFixed(0)}px`);
        recordingState.voiceAnimationId = window.requestAnimationFrame(updatePulse);
    };

    updatePulse();
}

function stopTrainingVoicePulse(recordingState, voiceTranscript) {
    if (recordingState.voiceAnimationId) {
        window.cancelAnimationFrame(recordingState.voiceAnimationId);
        recordingState.voiceAnimationId = null;
    }

    if (recordingState.voiceSource) {
        recordingState.voiceSource.disconnect();
        recordingState.voiceSource = null;
    }

    recordingState.voiceAnalyser = null;
    recordingState.voiceDataArray = null;
    resetTrainingVoicePulse(voiceTranscript);
}

function resetTrainingVoicePulse(voiceTranscript) {
    if (!voiceTranscript) {
        return;
    }

    voiceTranscript.classList.remove("is-listening");
    voiceTranscript.style.setProperty("--voice-pulse-scale", "1");
    voiceTranscript.style.setProperty("--voice-pulse-shadow", "6px");
}

async function stopTrainingRecordingAndUpload(recordingState, performanceId, question, voiceTranscript) {
    if (!recordingState.mediaRecorder || recordingState.mediaRecorder.state === "inactive") {
        stopTrainingVoicePulse(recordingState, voiceTranscript);
        return null;
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
    stopTrainingVoicePulse(recordingState, voiceTranscript);

    if (!audioBlob || audioBlob.size === 0) {
        return null;
    }

    return uploadTrainingQuestionAudio(performanceId, question.questionId, audioBlob);
}

function releaseTrainingMediaStream(recordingState, voiceTranscript) {
    stopTrainingVoicePulse(recordingState, voiceTranscript);

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
        voiceBadge.textContent = "마이크 사용 중";
        voiceGuide.textContent = customMessage || "질문에 답하시면 훈련 음성이 자동으로 저장됩니다.";
        return;
    }

    if (mode === "error") {
        voiceBadge.classList.add("is-error");
        voiceBadge.textContent = "훈련 음성 안내";
        voiceGuide.textContent = customMessage || "현재 기기에서는 훈련 음성 저장을 사용할 수 없습니다.";
        return;
    }

    voiceBadge.textContent = "음성 대기";
    voiceGuide.textContent = customMessage || "훈련 시작을 누르면 문항별 음성이 자동으로 저장됩니다.";
}

function normalizeImagePath(imagePath) {
    const normalized = String(imagePath || "").trim().replaceAll("\\", "/");
    if (!normalized) {
        return "";
    }

    if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
        return normalized;
    }

    if (normalized.startsWith("/cognitive-images/")) {
        return normalized;
    }

    const cognitiveImagesMarker = "/cognitive-images/";
    const markerIndex = normalized.indexOf(cognitiveImagesMarker);
    if (markerIndex >= 0) {
        return normalized.substring(markerIndex);
    }

    const trimmedPath = normalized.replace(/^\.?\//, "");
    if (trimmedPath.startsWith("cognitive-images/")) {
        return `/${trimmedPath}`;
    }

    return `/cognitive-images/${trimmedPath.split("/").pop()}`;
}

function formatScore(score) {
    const numericScore = Number(score ?? 0);
    return Number.isInteger(numericScore) ? `${numericScore}` : numericScore.toFixed(1);
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\"", "&quot;")
        .replaceAll("'", "&#39;");
}
