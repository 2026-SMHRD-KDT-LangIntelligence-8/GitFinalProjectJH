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
        document.getElementById("val-phone").textContent = formatPhoneNumber(recipient.emergencyContact);
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

        renderTrainingStatuses(recipient.trainingStatuses ?? [], recipient);
    } catch (error) {
        console.error(error);
    }
});

// 훈련 현황 영역은 최근 분석 점수가 낮은 유형부터 우선순위 카드로 표시한다.
// 검사 기록은 있지만 ANALYSIS_RESULTS가 없는 경우를 따로 구분해 오해를 줄인다.
function renderTrainingStatuses(trainingStatuses, recipient) {
    const container = document.getElementById("training-status-list");
    const hasExamHistory = Number(recipient?.testCount ?? 0) > 0 || Boolean(recipient?.latestTestDate);

    if (trainingStatuses.length === 0) {
        container.innerHTML = `
            <div class="recipient-empty-message">
                ${hasExamHistory
                    ? "검사 기록은 있지만 아직 훈련 현황을 계산할 분석 결과가 없습니다."
                    : "검사 이력이 없어 훈련 현황을 계산할 수 없습니다."}
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

// 상세 페이지는 전화번호를 보기 쉬운 형식으로만 바꿔서 표시한다.
function formatPhoneNumber(value) {
    const numbersOnly = String(value ?? "").replace(/[^0-9]/g, "");

    if (numbersOnly.length === 11) {
        return `${numbersOnly.slice(0, 3)}-${numbersOnly.slice(3, 7)}-${numbersOnly.slice(7)}`;
    }

    if (numbersOnly.length === 10) {
        return `${numbersOnly.slice(0, 3)}-${numbersOnly.slice(3, 6)}-${numbersOnly.slice(6)}`;
    }

    return value ?? "";
}
