const TEST_DURATION_SECONDS = 70;
const TEST_PROGRESS_STORAGE_KEY = "latestCognitiveTestProgress";

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

    const state = {
        recipientId: null,
        recipientName: "",
        questions: [],
        currentIndex: 0,
        timerId: null,
        remainingSeconds: TEST_DURATION_SECONDS,
        questionDurationSeconds: TEST_DURATION_SECONDS,
        timerStarted: false,
        completedQuestionIds: [],
        timedOutQuestionIds: []
    };

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
            state.recipientId = payload.recipientId;
            state.recipientName = payload.recipientName;
            state.questions = payload.questions;
            state.currentIndex = 0;
            state.questionDurationSeconds = payload.questionDurationSeconds || TEST_DURATION_SECONDS;
            state.remainingSeconds = state.questionDurationSeconds;
            state.timerStarted = false;
            state.completedQuestionIds = [];
            state.timedOutQuestionIds = [];

            saveTestProgress(state);

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

    timerStartButton.addEventListener("click", () => {
        timerStartButton.disabled = true;
        state.timerStarted = true;
        runQuestionTimer();
    });

    nextQuestionButton.addEventListener("click", () => {
        moveToNextQuestion(false);
    });

    window.addEventListener("beforeunload", () => {
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
                moveToNextQuestion(true);
            }
        }, 1000);
    }

    function moveToNextQuestion(timedOut) {
        const currentQuestion = state.questions[state.currentIndex];
        if (!currentQuestion) {
            return;
        }

        clearQuestionTimer();
        state.timerStarted = false;
        markQuestionCompleted(currentQuestion.questionId, timedOut);

        if (state.currentIndex >= state.questions.length - 1) {
            finishTest().catch((error) => {
                console.error(error);
                alert("검사 완료 기록 저장에 실패했습니다. 다시 시도해주세요.");
            });
            return;
        }

        state.currentIndex += 1;
        state.remainingSeconds = state.questionDurationSeconds;
        timerStartButton.disabled = false;
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
        saveTestProgress(state, true);

        // 검사 종료 직후 완료 API를 호출해 검사 횟수와 최근 검사일 집계용 기록을 남긴다.
        await completeTest(state.recipientId);
        sessionStorage.removeItem(TEST_PROGRESS_STORAGE_KEY);

        alert("인지능력 검사가 완료되었습니다.");
        window.location.href = "/test";
    }
});

async function loadRecipients(recipientSelect) {
    const response = await fetch("/api/recipients");
    if (!response.ok) {
        throw new Error("수급자 조회 실패");
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
        throw new Error("검사 시작 실패");
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
        throw new Error("검사 완료 저장 실패");
    }
}

function saveTestProgress(state, completed = false) {
    const questionsByType = new Map();
    const completedCounts = new Map();
    const timedOutCounts = new Map();

    state.questions.forEach((question) => {
        const currentCount = questionsByType.get(question.questionTypeId) || 0;
        questionsByType.set(question.questionTypeId, currentCount + 1);
    });

    state.questions
        .filter((question) => state.completedQuestionIds.includes(question.questionId))
        .forEach((question) => {
            completedCounts.set(
                question.questionTypeId,
                (completedCounts.get(question.questionTypeId) || 0) + 1
            );
        });

    state.questions
        .filter((question) => state.timedOutQuestionIds.includes(question.questionId))
        .forEach((question) => {
            timedOutCounts.set(
                question.questionTypeId,
                (timedOutCounts.get(question.questionTypeId) || 0) + 1
            );
        });

    const weakTypeIds = Array.from(questionsByType.entries())
        .filter(([questionTypeId, totalCount]) => {
            const completedCount = completedCounts.get(questionTypeId) || 0;
            const timedOutCount = timedOutCounts.get(questionTypeId) || 0;
            return completedCount < totalCount || timedOutCount > 0;
        })
        .map(([questionTypeId]) => questionTypeId);

    const summary = {
        recipientId: state.recipientId,
        recipientName: state.recipientName,
        completed,
        currentIndex: state.currentIndex,
        completedQuestionIds: [...state.completedQuestionIds],
        timedOutQuestionIds: [...state.timedOutQuestionIds],
        weakTypeIds,
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
