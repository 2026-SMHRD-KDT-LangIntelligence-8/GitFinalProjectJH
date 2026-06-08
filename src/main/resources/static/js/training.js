const TRAINING_SESSION_STORAGE_KEY = "trainingStartPayload";

document.addEventListener("DOMContentLoaded", async () => {
    const recipientSelect = document.getElementById("recipient-select");
    const startButton = document.getElementById("start-training-btn");

    try {
        await loadRecipients(recipientSelect);
    } catch (error) {
        console.error(error);
        alert("수급자 목록을 불러오지 못했습니다.");
        return;
    }

    startButton.addEventListener("click", async () => {
        if (!recipientSelect.value) {
            alert("수급자를 먼저 선택해주세요.");
            return;
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
        throw new Error("훈련 시작 실패");
    }

    return response.json();
}
