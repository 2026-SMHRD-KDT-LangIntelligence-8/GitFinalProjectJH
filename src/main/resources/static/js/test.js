const TEST_DURATION_SECONDS = 70;

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

    // 한 페이지 안에서 검사 진행 상태를 유지하기 위한 화면 전용 상태다.
    const state = {
        questions: [],
        currentIndex: 0,
        timerId: null,
        remainingSeconds: TEST_DURATION_SECONDS,
        questionDurationSeconds: TEST_DURATION_SECONDS,
        recipientName: ""
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
            state.questions = payload.questions;
            state.currentIndex = 0;
            state.questionDurationSeconds = payload.questionDurationSeconds || TEST_DURATION_SECONDS;
            state.remainingSeconds = state.questionDurationSeconds;
            state.recipientName = payload.recipientName;

            introView.classList.add("hidden");
            sessionView.classList.remove("hidden");
            recipientNameChip.textContent = `${payload.recipientName} 검사`;

            renderCurrentQuestion();
            runQuestionTimer();
        } catch (error) {
            console.error(error);
            alert("검사 문항을 불러오지 못했습니다.");
            startButton.disabled = false;
        }
    });

    function renderCurrentQuestion() {
        const currentQuestion = state.questions[state.currentIndex];
        if (!currentQuestion) {
            return;
        }

        questionProgressChip.textContent = `${state.currentIndex + 1} / ${state.questions.length}`;
        questionTypeName.textContent = currentQuestion.questionTypeName;
        questionSequenceText.textContent = `유형 내 ${currentQuestion.questionSequence}번`;
        questionText.textContent = currentQuestion.questionText;

        toggleTextBlock(
            questionPurpose,
            currentQuestion.questionPurpose,
            `검사 의도: ${currentQuestion.questionPurpose}`
        );

        // 이미지형 문항만 이미지 영역을 보여주고, 나머지는 텍스트 중심으로 표시한다.
        const normalizedImagePath = normalizeImagePath(currentQuestion.imageFilePath);
        if (normalizedImagePath) {
            questionImage.src = normalizedImagePath;
            questionImageWrap.classList.remove("hidden");
        } else {
            questionImage.removeAttribute("src");
            questionImageWrap.classList.add("hidden");
        }

        toggleTextBlock(
            questionCriteria,
            currentQuestion.imageDescriptionCriteria,
            `설명 기준: ${currentQuestion.imageDescriptionCriteria}`
        );

        updateTimerText(state.remainingSeconds);
    }

    function runQuestionTimer() {
        clearQuestionTimer();
        updateTimerText(state.remainingSeconds);

        // 문항당 70초가 지나면 완료 알림 후 다음 문제로 자동 이동한다.
        state.timerId = window.setInterval(() => {
            state.remainingSeconds -= 1;
            updateTimerText(state.remainingSeconds);

            if (state.remainingSeconds <= 0) {
                clearQuestionTimer();
                moveToNextQuestion();
            }
        }, 1000);
    }

    function moveToNextQuestion() {
        const completedQuestionNumber = state.currentIndex + 1;
        alert(`${completedQuestionNumber}번 문제 검사가 완료되었습니다.`);

        if (completedQuestionNumber >= state.questions.length) {
            alert("인지능력 검사가 완료되었습니다.");
            window.location.href = "/test";
            return;
        }

        state.currentIndex += 1;
        state.remainingSeconds = state.questionDurationSeconds;
        renderCurrentQuestion();
        runQuestionTimer();
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

    function toggleTextBlock(element, value, text) {
        if (value) {
            element.textContent = text;
            element.classList.remove("hidden");
            return;
        }

        element.textContent = "";
        element.classList.add("hidden");
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
    // 서버가 유형별 랜덤 5문항씩 묶어서 내려주는 시작 API다.
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

function normalizeImagePath(imageFilePath) {
    // DB 상대 경로와 절대 경로를 모두 브라우저에서 열 수 있게 정규화한다.
    if (!imageFilePath) {
        return "";
    }

    if (imageFilePath.startsWith("http://") || imageFilePath.startsWith("https://") || imageFilePath.startsWith("/")) {
        return imageFilePath;
    }

    return `/${imageFilePath.replace(/^\.?\//, "")}`;
}
