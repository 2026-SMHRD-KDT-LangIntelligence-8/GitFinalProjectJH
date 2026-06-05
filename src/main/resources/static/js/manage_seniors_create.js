// 수급자 등록 페이지 전용 스크립트.
// 등록 요청이 성공하면 서버가 RECIPIENTS 저장과 USER_RECIPIENTS 매핑 생성을 함께 처리한다.
document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("recipient-create-form");
    const cancelButton = document.getElementById("create-cancel-button");
    const recipientNameInput = document.getElementById("create-recipient-name");
    const emergencyContactInput = document.getElementById("create-emergency-contact");

    cancelButton.addEventListener("click", () => {
        window.location.href = "/manage-seniors";
    });

    // 수급자명은 한글과 영문만 입력 가능하도록 제한하고 숫자 및 특수문자는 제거한다.
    recipientNameInput.addEventListener("input", (event) => {
        event.target.value = event.target.value.replace(/[^a-zA-Z가-힣\s]/g, "");
    });

    // 숫자만 최대 11자리까지 허용하고, 입력 중에 자동으로 하이픈을 넣어준다.
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
            // 031, 062 같은 지역번호는 3-x-4 형식으로 우선 처리한다.
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

        // 수급자 등록에 필요한 5개 기본 항목은 모두 입력되어야 저장할 수 있다.
        if (!recipientName || !birthDate || !gender || !careGrade || !emergencyContact) {
            alert("수급자명, 생년월일, 성별, 장기요양등급, 비상연락망은 필수 입력입니다.");
            return;
        }

        const payload = {
            recipientName,
            birthDate,
            gender,
            careGrade,
            guardianName: document.getElementById("create-guardian-name").value,
            // DB에는 비상연락망을 숫자만 저장해 형식 차이에 영향을 받지 않도록 한다.
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
                throw new Error("수급자 등록 실패");
            }

            // 등록 후 목록으로 돌아가면 새로 추가한 수급자가 현재 사용자 목록에 보이는지 바로 확인할 수 있다.
            alert("수급자 등록이 완료되었습니다.");
            window.location.href = "/manage-seniors";
        } catch (error) {
            console.error(error);
            alert("수급자 등록 저장에 실패했습니다.");
        }
    });
});
