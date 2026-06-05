// Recipient create page script.
// After the form is submitted, the server creates the recipient row and the USER_RECIPIENTS mapping for the logged-in Kakao user.
document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("recipient-create-form");
    const cancelButton = document.getElementById("create-cancel-button");
    const emergencyContactInput = document.getElementById("create-emergency-contact");

    cancelButton.addEventListener("click", () => {
        window.location.href = "/manage-seniors";
    });

    // Keep only digits, limit to 11 numbers, and insert hyphens while the user types.
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
            // Handle area codes such as 031 and 062 with the 3-x-4 pattern.
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
            // Store the phone number as digits only so the database stays format-neutral.
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

            // After success, return to the list page where the new user-recipient mapping can be verified.
            alert("수급자 등록이 완료되었습니다.");
            window.location.href = "/manage-seniors";
        } catch (error) {
            console.error(error);
            alert("수급자 등록 저장에 실패했습니다.");
        }
    });
});
