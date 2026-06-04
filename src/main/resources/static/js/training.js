// 인지훈련 시작 화면 전용 스크립트.
// 검사 화면과 동일하게 DB의 수급자 목록을 불러와 선택 박스에 채운다.
document.addEventListener("DOMContentLoaded", async () => {
    const recipientSelect = document.getElementById("recipient-select");

    try {
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
    } catch (error) {
        console.error(error);
    }
});
