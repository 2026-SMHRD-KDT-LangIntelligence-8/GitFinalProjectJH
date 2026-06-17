const TRAINING_SESSION_STORAGE_KEY = "trainingStartPayload";

document.addEventListener("DOMContentLoaded", async () => {
    const recipientSelect = document.getElementById("recipient-select");
    const startButton = document.getElementById("start-training-btn");
    const statusMessage = document.getElementById("training-status-message");
    const recipientNameLabel = document.getElementById("training-recipient-name");
    const graphicContainer = document.getElementById("training-graphic-container");
    let currentRecipientDetail = null;

    try {
        await loadRecipients(recipientSelect);
    } catch (error) {
        console.error(error);
        alert("수급자 목록을 불러오지 못했습니다.");
        return;
    }

    startButton.disabled = true;

    recipientSelect.addEventListener("change", async () => {
        currentRecipientDetail = null;

        if (!recipientSelect.value) {
            startButton.disabled = true;
            setStatusMessage(statusMessage, "");
            setRecipientState(recipientNameLabel, graphicContainer, "");
            return;
        }

        startButton.disabled = true;

        try {
            currentRecipientDetail = await fetchRecipientDetail(recipientSelect.value);
            const trainingStatuses = Array.isArray(currentRecipientDetail.trainingStatuses)
                ? currentRecipientDetail.trainingStatuses
                : [];

            if (!trainingStatuses.length) {
                setRecipientState(recipientNameLabel, graphicContainer, "");
                setStatusMessage(statusMessage, "리포트 결과가 없어 훈련 항목을 아직 확인할 수 없습니다. 먼저 인지능력 검사를 진행해주세요.");
                return;
            }

            const hasWeakType = trainingStatuses.some((status) => status.trainingNeeded);
            if (!hasWeakType) {
                setRecipientState(recipientNameLabel, graphicContainer, "");
                setStatusMessage(statusMessage, "해당 수급자는 인지능력 검사 결과 안정권이므로 훈련이 필요하지 않습니다.");
                return;
            }

            setRecipientState(recipientNameLabel, graphicContainer, currentRecipientDetail.recipientName ?? "");
            setStatusMessage(statusMessage, "");
            startButton.disabled = false;
        } catch (error) {
            console.error(error);
            setRecipientState(recipientNameLabel, graphicContainer, "");
            setStatusMessage(statusMessage, "훈련 가능 항목을 확인하지 못했습니다. 다시 선택해주세요.");
        }
    });

    startButton.addEventListener("click", async () => {
        if (!recipientSelect.value) {
            alert("수급자를 먼저 선택해주세요.");
            return;
        }

        if (currentRecipientDetail) {
            const trainingStatuses = Array.isArray(currentRecipientDetail.trainingStatuses)
                ? currentRecipientDetail.trainingStatuses
                : [];

            if (!trainingStatuses.some((status) => status.trainingNeeded)) {
                setRecipientState(recipientNameLabel, graphicContainer, "");
                setStatusMessage(statusMessage, "해당 수급자는 인지능력 검사 결과 안정권이므로 훈련이 필요하지 않습니다.");
                return;
            }
        }

        startButton.disabled = true;

        try {
            const payload = await startTraining(recipientSelect.value);
            sessionStorage.setItem(TRAINING_SESSION_STORAGE_KEY, JSON.stringify(payload));
            window.location.href = "/training-program";
        } catch (error) {
            console.error(error);
            alert("훈련 데이터를 불러오지 못했습니다.");
            startButton.disabled = false;
        }
    });
});

function setStatusMessage(element, message) {
    if (!element) {
        return;
    }

    const normalizedMessage = String(message || "").trim();
    element.textContent = normalizedMessage;
    element.classList.toggle("hidden", !normalizedMessage);
}

function setRecipientState(recipientNameLabel, graphicContainer, recipientName) {
    const normalizedName = String(recipientName || "").trim();

    if (recipientNameLabel) {
        recipientNameLabel.textContent = normalizedName;
        recipientNameLabel.classList.toggle("hidden", !normalizedName);
    }

    graphicContainer?.classList.toggle("training-graphic-hidden", Boolean(normalizedName));
}

async function fetchRecipientDetail(recipientId) {
    const response = await fetch(`/api/recipients/${recipientId}/detail`);
    if (!response.ok) {
        throw new Error("recipient_detail_failed");
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

async function startTraining(recipientId) {
    const response = await fetch("/api/cognitive-tests/training/start", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            recipientId: Number(recipientId)
        })
    });

    if (!response.ok) {
        throw new Error("training_start_failed");
    }

    return response.json();
}
