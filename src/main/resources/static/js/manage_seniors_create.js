// 수급자 등록 페이지 전용 스크립트.
// 등록 폼에서 입력한 값을 POST API로 보내고, 저장 완료 후 목록 페이지로 복귀시킨다.
document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("recipient-create-form");
    const cancelButton = document.getElementById("create-cancel-button");

    cancelButton.addEventListener("click", () => {
        window.location.href = "/manage-seniors";
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const payload = {
            recipientName: document.getElementById("create-recipient-name").value,
            birthDate: document.getElementById("create-birth-date").value,
            gender: document.getElementById("create-gender").value,
            careGrade: document.getElementById("create-care-grade").value,
            guardianName: document.getElementById("create-guardian-name").value,
            emergencyContact: document.getElementById("create-emergency-contact").value,
            notes: document.getElementById("create-notes").value
        };

        try {
            const response = await fetch("/api/recipients", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error("수급자 등록 실패");
            }

            // 등록 성공 시 완료 알림을 먼저 보여 준 뒤 목록 페이지로 돌아간다.
            alert("수급자 등록이 완료되었습니다.");
            window.location.href = "/manage-seniors";
        } catch (error) {
            console.error(error);
            alert("수급자 등록 저장에 실패했습니다.");
        }
    });
});
