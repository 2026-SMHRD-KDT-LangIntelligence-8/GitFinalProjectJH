// 수급자 등록 페이지 전용 스크립트.
// 등록 폼에서 입력한 값을 POST API로 보내고, 저장 완료 후 목록 페이지로 복귀시킨다.
document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("recipient-create-form");
    const cancelButton = document.getElementById("create-cancel-button");
    const emergencyContactInput = document.getElementById("create-emergency-contact");

    cancelButton.addEventListener("click", () => {
        window.location.href = "/manage-seniors";
    });

    // 비상연락망은 숫자만 최대 11자리까지 허용하고, 번호 체계에 맞춰 하이픈을 자동으로 넣는다.
    emergencyContactInput.addEventListener("input", (event) => {
        const numbersOnly = event.target.value.replace(/[^0-9]/g, "").slice(0, 11);
        let formattedValue = numbersOnly;

        if (numbersOnly.startsWith("02")) {
            if (numbersOnly.length <= 2) {
                formattedValue = numbersOnly;
            } else if (numbersOnly.length <= 5) {
                formattedValue = `${numbersOnly.slice(0, 2)}-${numbersOnly.slice(2)}`;
            } else if (numbersOnly.length <= 9) {
                formattedValue = `${numbersOnly.slice(0, 2)}-${numbersOnly.slice(2, numbersOnly.length - 4)}-${numbersOnly.slice(-4)}`;
            } else {
                formattedValue = `${numbersOnly.slice(0, 2)}-${numbersOnly.slice(2, 6)}-${numbersOnly.slice(6)}`;
            }
        } else if (
            numbersOnly.startsWith("010") ||
            numbersOnly.startsWith("011") ||
            numbersOnly.startsWith("016") ||
            numbersOnly.startsWith("017") ||
            numbersOnly.startsWith("018") ||
            numbersOnly.startsWith("019")
        ) {
            if (numbersOnly.length <= 3) {
                formattedValue = numbersOnly;
            } else if (numbersOnly.length <= 7) {
                formattedValue = `${numbersOnly.slice(0, 3)}-${numbersOnly.slice(3)}`;
            } else {
                formattedValue = `${numbersOnly.slice(0, 3)}-${numbersOnly.slice(3, 7)}-${numbersOnly.slice(7)}`;
            }
        } else {
            // 031, 062 같은 지역번호는 3자리 국번 기준으로 우선 처리한다.
            if (numbersOnly.length <= 3) {
                formattedValue = numbersOnly;
            } else if (numbersOnly.length <= 6) {
                formattedValue = `${numbersOnly.slice(0, 3)}-${numbersOnly.slice(3)}`;
            } else if (numbersOnly.length <= 10) {
                formattedValue = `${numbersOnly.slice(0, 3)}-${numbersOnly.slice(3, numbersOnly.length - 4)}-${numbersOnly.slice(-4)}`;
            } else {
                formattedValue = `${numbersOnly.slice(0, 3)}-${numbersOnly.slice(3, 7)}-${numbersOnly.slice(7)}`;
            }
        }

        event.target.value = formattedValue;
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const payload = {
            recipientName: document.getElementById("create-recipient-name").value,
            birthDate: document.getElementById("create-birth-date").value,
            gender: document.getElementById("create-gender").value,
            careGrade: document.getElementById("create-care-grade").value,
            guardianName: document.getElementById("create-guardian-name").value,
            // DB에는 비상 연락망을 숫자만 저장하도록 처리한다.
            emergencyContact: document.getElementById("create-emergency-contact").value.replace(/[^0-9]/g, ""),
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
