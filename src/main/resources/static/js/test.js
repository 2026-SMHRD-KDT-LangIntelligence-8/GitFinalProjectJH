// 인지능력 검사 시작 화면 전용 스크립트.
// DB의 수급자 목록을 드롭다운에 채워서 하드코딩된 옵션 없이 바로 선택할 수 있게 한다.
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
