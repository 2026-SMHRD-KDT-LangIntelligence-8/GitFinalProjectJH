document.addEventListener("DOMContentLoaded", async () => {
    const licenseNumberInput = document.getElementById("caregiver-license-number");
    const organizationNameInput = document.getElementById("caregiver-organization-name");
    const saveButton = document.getElementById("caregiver-info-save-button");

    const params = new URLSearchParams(window.location.search);
    if (params.get("login") === "success") {
        localStorage.setItem("isLoggedIn", "true");
        window.history.replaceState({}, document.title, "/caregiver-info");
    }

    try {
        const response = await fetch("/api/users/caregiver-info", {
            cache: "no-store"
        });

        if (response.ok) {
            const profile = await response.json();
            licenseNumberInput.value = profile.caregiverLicenseNumber ?? "";
            organizationNameInput.value = profile.organizationName ?? "";

            if (licenseNumberInput.value.trim() && organizationNameInput.value.trim()) {
                window.location.href = "/main";
                return;
            }
        }
    } catch (error) {
        console.error(error);
    }

    saveButton.addEventListener("click", async () => {
        const caregiverLicenseNumber = licenseNumberInput.value.trim();
        const organizationName = organizationNameInput.value.trim();

        if (!caregiverLicenseNumber) {
            alert("요양보호사 자격번호를 입력해주세요.");
            licenseNumberInput.focus();
            return;
        }

        if (!organizationName) {
            alert("소속 기관을 입력해주세요.");
            organizationNameInput.focus();
            return;
        }

        saveButton.disabled = true;

        try {
            const response = await fetch("/api/users/caregiver-info", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    caregiverLicenseNumber,
                    organizationName
                })
            });

            if (!response.ok) {
                throw new Error("caregiver_info_save_failed");
            }

            alert("추가 정보가 저장되었습니다.");
            window.location.href = "/main";
        } catch (error) {
            console.error(error);
            alert("추가 정보 저장에 실패했습니다.");
            saveButton.disabled = false;
        }
    });
});
