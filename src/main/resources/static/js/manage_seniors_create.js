document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("recipient-create-form");
    const cancelButton = document.getElementById("create-cancel-button");
    const recipientNameInput = document.getElementById("create-recipient-name");
    const emergencyContactInput = document.getElementById("create-emergency-contact");
    let isComposingRecipientName = false;

    cancelButton.addEventListener("click", () => {
        window.location.href = "/manage-seniors";
    });

    // 한글 IME 조합 중에는 값을 건드리지 않고, 조합이 끝난 뒤에만 허용 문자로 정리한다.
    recipientNameInput.addEventListener("compositionstart", () => {
        isComposingRecipientName = true;
    });

    recipientNameInput.addEventListener("compositionend", (event) => {
        isComposingRecipientName = false;
        event.target.value = sanitizeRecipientName(event.target.value);
    });

    recipientNameInput.addEventListener("input", (event) => {
        if (isComposingRecipientName) {
            return;
        }

        event.target.value = sanitizeRecipientName(event.target.value);
    });

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

        const recipientName = document.getElementById("create-recipient-name").value.trim();
        const birthDate = document.getElementById("create-birth-date").value;
        const gender = document.getElementById("create-gender").value;
        const careGrade = document.getElementById("create-care-grade").value;
        const emergencyContact = document.getElementById("create-emergency-contact").value.replace(/[^0-9]/g, "");

        if (!recipientName || !birthDate || !gender || !careGrade || !emergencyContact) {
            alert("수급자명, 생년월일, 성별, 요양등급, 비상연락망은 필수 입력입니다.");
            return;
        }

        const payload = {
            recipientName,
            birthDate,
            gender,
            careGrade,
            guardianName: document.getElementById("create-guardian-name").value,
            emergencyContact,
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
                throw new Error("recipient_create_failed");
            }

            alert("수급자 등록이 완료되었습니다.");
            window.location.href = "/manage-seniors";
        } catch (error) {
            console.error(error);
            alert("수급자 등록 처리에 실패했습니다.");
        }
    });
});

function sanitizeRecipientName(value) {
    return String(value ?? "").replace(/[^a-zA-Z가-힣\s]/g, "");
}
