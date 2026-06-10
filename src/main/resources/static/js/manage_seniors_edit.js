// 수급자 수정 페이지 전용 스크립트.
// 상세 화면에서 전달한 recipientId를 기준으로 수정 대상 데이터를 불러오고, 저장 시 PUT API를 호출한다.
document.addEventListener("DOMContentLoaded", async () => {
    const params = new URLSearchParams(window.location.search);
    const recipientId = params.get("recipientId");

    if (!recipientId) {
        window.location.href = "/manage-seniors";
        return;
    }

    const backLink = document.getElementById("edit-back-link");
    const cancelButton = document.getElementById("edit-cancel-button");
    const form = document.getElementById("recipient-edit-form");
    const emergencyContactInput = document.getElementById("edit-emergency-contact");

    const detailUrl = `/manage-seniors/detail?recipientId=${recipientId}`;
    backLink.href = detailUrl;

    cancelButton.addEventListener("click", () => {
        window.location.href = detailUrl;
    });

    try {
        const response = await fetch(`/api/recipients/${recipientId}`);
        if (!response.ok) {
            throw new Error("수급자 수정 대상 조회 실패");
        }

        const recipient = await response.json();

        // 수정 페이지는 변경 가능한 항목만 input에 채우고, 이름은 식별용으로 읽기 전용 표시만 한다.
        document.getElementById("edit-recipient-name").value = recipient.recipientName ?? "";
        document.getElementById("edit-birth-date").value = recipient.birthDate ?? "";
        document.getElementById("edit-gender").value = normalizeGenderValue(recipient.gender);
        document.getElementById("edit-care-grade").value = recipient.careGrade ?? "";
        document.getElementById("edit-guardian-name").value = recipient.guardianName ?? "";
        emergencyContactInput.value = formatPhoneNumber(recipient.emergencyContact);
    } catch (error) {
        console.error(error);
        alert("수급자 정보를 불러오지 못했습니다.");
        window.location.href = "/manage-seniors";
        return;
    }

    emergencyContactInput.addEventListener("input", (event) => {
        event.target.value = formatPhoneNumber(event.target.value);
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const payload = {
            birthDate: document.getElementById("edit-birth-date").value,
            gender: document.getElementById("edit-gender").value,
            careGrade: document.getElementById("edit-care-grade").value,
            guardianName: document.getElementById("edit-guardian-name").value,
            emergencyContact: emergencyContactInput.value.replace(/[^0-9]/g, "")
        };

        try {
            const response = await fetch(`/api/recipients/${recipientId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error("수급자 수정 저장 실패");
            }

            // 저장 성공 시 완료 알림을 먼저 보여 준 뒤 상세 페이지로 돌아간다.
            alert("수정이 완료되었습니다.");
            window.location.href = detailUrl;
        } catch (error) {
            console.error(error);
            alert("수급자 수정 저장에 실패했습니다.");
        }
    });
});

function normalizeGenderValue(gender) {
    if (gender === "남" || gender === "남성" || gender === "male") {
        return "남";
    }

    if (gender === "여" || gender === "여성" || gender === "female") {
        return "여";
    }

    return "";
}

function formatPhoneNumber(value) {
    const numbersOnly = String(value ?? "").replace(/[^0-9]/g, "").slice(0, 11);

    if (numbersOnly.length <= 3) {
        return numbersOnly;
    }

    if (numbersOnly.length <= 7) {
        return `${numbersOnly.slice(0, 3)}-${numbersOnly.slice(3)}`;
    }

    return `${numbersOnly.slice(0, 3)}-${numbersOnly.slice(3, 7)}-${numbersOnly.slice(7)}`;
}
