// 수급자 상세 화면은 전용 상세 API를 호출해 기본 정보와 검사/훈련 요약을 함께 채운다.
document.addEventListener("DOMContentLoaded", async () => {
    const params = new URLSearchParams(window.location.search);
    const recipientId = params.get("recipientId");

    if (!recipientId) {
        return;
    }

    try {
        const response = await fetch(`/api/recipients/${recipientId}/detail`);
        if (!response.ok) {
            throw new Error("수급자 상세 조회 실패");
        }

        const recipient = await response.json();

        document.getElementById("val-name").textContent = recipient.recipientName ?? "";
        document.getElementById("val-keypad").value = recipient.birthDate ?? "";
        document.getElementById("val-guardian-name").textContent = recipient.guardianName ?? "";
        document.getElementById("val-phone").textContent = recipient.emergencyContact ?? "";
        document.getElementById("val-count").textContent = String(recipient.testCount ?? 0);
        document.getElementById("val-date").textContent = recipient.latestTestDate ?? "-";
        document.getElementById("notes-textarea").value = recipient.notes ?? "";

        const genderSelect = document.getElementById("toggle-gender");
        const gradeSelect = document.getElementById("toggle-grade");

        if (recipient.gender === "남" || recipient.gender === "남성" || recipient.gender === "male") {
            genderSelect.value = "male";
        } else if (recipient.gender === "여" || recipient.gender === "여성" || recipient.gender === "female") {
            genderSelect.value = "female";
        }

        if (recipient.careGrade) {
            gradeSelect.value = recipient.careGrade.replace("등급", "");
        }

        renderTrainingStatuses(recipient.trainingStatuses ?? []);
    } catch (error) {
        console.error(error);
    }
});

// 훈련 현황 영역은 최근 분석 점수가 낮은 유형부터 우선순위 카드로 표시한다.
function renderTrainingStatuses(trainingStatuses) {
    const container = document.getElementById("training-status-list");

    if (trainingStatuses.length === 0) {
        container.innerHTML = `
            <div class="recipient-empty-message">
                검사 이력이 없어 훈련 현황을 계산할 수 없습니다.
            </div>
        `;
        return;
    }

    container.innerHTML = trainingStatuses.map((status) => `
        <div class="recipient-row">
            <span class="recipient-cell w-name">${escapeHtml(status.questionTypeName)}</span>
            <span class="recipient-cell w-grade">${escapeHtml(status.statusLabel)}</span>
            <span class="recipient-cell w-birth">평균 ${status.averageAppropriatenessScore}점</span>
        </div>
    `).join("");
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\"", "&quot;")
        .replaceAll("'", "&#39;");
}
