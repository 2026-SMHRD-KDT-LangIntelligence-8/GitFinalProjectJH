// 수급자 상세 화면에서 URL의 recipientId를 읽어 실제 DB 데이터를 화면에 채운다.
// 목록에서 클릭한 대상과 상세 화면 정보가 이어지도록 하는 연결 스크립트다.
document.addEventListener("DOMContentLoaded", async () => {
    const params = new URLSearchParams(window.location.search);
    const recipientId = params.get("recipientId");

    if (!recipientId) {
        return;
    }

    try {
        const response = await fetch(`/api/recipients/${recipientId}`);
        if (!response.ok) {
            throw new Error("수급자 상세 조회 실패");
        }

        const recipient = await response.json();

        document.getElementById("val-name").textContent = recipient.recipientName ?? "";
        document.getElementById("val-keypad").value = recipient.birthDate ?? "";
        document.getElementById("val-guardian-name").textContent = recipient.guardianName ?? "";
        document.getElementById("val-phone").textContent = recipient.emergencyContact ?? "";

        // DB 값은 남/여, 1등급~5등급 형태이므로 현재 select 값으로 맞춰서 변환한다.
        const genderSelect = document.getElementById("toggle-gender");
        const gradeSelect = document.getElementById("toggle-grade");

        if (recipient.gender === "남") {
            genderSelect.value = "male";
        } else if (recipient.gender === "여") {
            genderSelect.value = "female";
        }

        if (recipient.careGrade) {
            gradeSelect.value = recipient.careGrade.replace("등급", "");
        }
    } catch (error) {
        console.error(error);
    }
});
