const TRAINING_SESSION_STORAGE_KEY = "trainingStartPayload";
const TEST_PROGRESS_STORAGE_KEY = "latestCognitiveTestProgress";

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

        item.addEventListener("click", (event) => {
            event.preventDefault();
            renderTrainingQuestionSession(trainingList, payload, weakPrograms, question.questionTypeId);
        });

        trainingList.appendChild(item);
    });
}

function renderTrainingQuestionSession(trainingList, payload, weakPrograms, selectedTypeId) {
    const selectedQuestions = payload.questions.filter((question) => question.questionTypeId === selectedTypeId);
    if (selectedQuestions.length === 0) {
        trainingList.innerHTML = "<p class=\"question-purpose\">선택한 훈련 문항을 찾지 못했습니다.</p>";
        return;
    }

    let currentIndex = 0;

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
        </div>
        <div class="test-session-actions">
            <button type="button" class="timer-start-btn" id="training-list-button">목록으로</button>
            <button type="button" class="next-question-btn" id="training-next-button">다음 문제</button>
        </div>
    `;

    const typeNameElement = document.getElementById("training-type-name");
    const progressTextElement = document.getElementById("training-progress-text");
    const questionTextElement = document.getElementById("training-question-text");
    const imageWrapElement = document.getElementById("training-image-wrap");
    const imageElement = document.getElementById("training-image");
    const listButton = document.getElementById("training-list-button");
    const nextButton = document.getElementById("training-next-button");

    listButton.addEventListener("click", () => {
        renderTrainingProgramList(trainingList, payload, weakPrograms);
    });

    nextButton.addEventListener("click", () => {
        if (currentIndex >= selectedQuestions.length - 1) {
            renderTrainingProgramList(trainingList, payload, weakPrograms);
            return;
        }

        currentIndex += 1;
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
