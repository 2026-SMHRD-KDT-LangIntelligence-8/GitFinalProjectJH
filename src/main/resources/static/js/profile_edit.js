// 개인정보수정 화면 전용 스크립트.
// 전화번호 자동 하이픈 처리, 이메일 도메인 선택/직접 입력 토글,
// 그리고 최소 1개 항목이 바뀌었을 때만 저장되도록 하는 흐름을 담당한다.
document.addEventListener("DOMContentLoaded", () => {
    const storageKey = "profile_edit_form";

    const nameInput = document.getElementById("profile-name");
    const phoneInput = document.getElementById("profile-phone");
    const domainSelect = document.getElementById("email-domain-select");
    const customDomainInput = document.getElementById("email-domain-custom");
    const emailIdInput = document.getElementById("email-id");
    const caregiverLicenseNumberInput = document.getElementById("profile-caregiver-license-number");
    const organizationNameInput = document.getElementById("profile-organization-name");
    const saveButton = document.getElementById("profile-save-button");
    const withdrawButton = document.getElementById("profile-withdraw-button");
    const sanitizeCaregiverLicenseNumber = (value) => String(value ?? "").replace(/\D/g, "").slice(0, 11);
    const formatCaregiverLicenseNumber = (value) => {
        const digits = sanitizeCaregiverLicenseNumber(value);
        if (digits.length <= 4) {
            return digits;
        }
        return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    };

    const defaultProfile = {
        name: "",
        emailId: "",
        emailDomain: "naver.com",
        emailDomainCustom: "",
        phone: "",
        caregiverLicenseNumber: "",
        organizationName: ""
    };

    // 현재 입력 상태를 하나의 객체로 모아두면 변경 여부 비교와 저장 처리가 단순해진다.
    const getCurrentProfile = () => ({
        name: nameInput.value.trim(),
        emailId: emailIdInput.value.trim(),
        emailDomain: domainSelect.value,
        emailDomainCustom: customDomainInput.value.trim(),
        phone: phoneInput.value.trim(),
        caregiverLicenseNumber: sanitizeCaregiverLicenseNumber(caregiverLicenseNumberInput.value),
        organizationName: organizationNameInput.value.trim()
    });

    const resolveEmail = (profile) => {
        const domain = profile.emailDomain === "직접입력" ? profile.emailDomainCustom : profile.emailDomain;
        return profile.emailId && domain ? `${profile.emailId}@${domain}` : "";
    };

    const applyEmailToInputs = (email) => {
        if (!email || !email.includes("@")) {
            return;
        }

        const [emailId, ...domainParts] = email.split("@");
        const emailDomain = domainParts.join("@");
        const presetDomains = Array.from(domainSelect.options).map((option) => option.value);

        emailIdInput.value = emailId;
        if (presetDomains.includes(emailDomain)) {
            domainSelect.value = emailDomain;
            customDomainInput.value = "";
            customDomainInput.classList.add("hidden");
            return;
        }

        domainSelect.value = "직접입력";
        customDomainInput.value = emailDomain;
        customDomainInput.classList.remove("hidden");
    };

    // localStorage에 저장된 값이 있으면 불러오고, 없으면 기본값으로 시작한다.
    const loadSavedProfile = () => {
        try {
            const savedValue = localStorage.getItem(storageKey);
            return savedValue ? JSON.parse(savedValue) : defaultProfile;
        } catch (error) {
            console.error(error);
            return defaultProfile;
        }
    };

    const applyProfileToInputs = (profile) => {
        nameInput.value = profile.name ?? "";
        emailIdInput.value = profile.emailId ?? "";
        domainSelect.value = profile.emailDomain ?? "naver.com";
        customDomainInput.value = profile.emailDomainCustom ?? "";
        phoneInput.value = profile.phone ?? "";
        caregiverLicenseNumberInput.value = formatCaregiverLicenseNumber(profile.caregiverLicenseNumber);
        organizationNameInput.value = profile.organizationName ?? "";

        const isCustomDomain = domainSelect.value === "직접입력";
        customDomainInput.classList.toggle("hidden", !isCustomDomain);
    };

    let originalProfile = loadSavedProfile();
    applyProfileToInputs(originalProfile);

    caregiverLicenseNumberInput.addEventListener("input", () => {
        caregiverLicenseNumberInput.value = formatCaregiverLicenseNumber(caregiverLicenseNumberInput.value);
    });

    const loadKakaoProfileName = async () => {
        try {
            const response = await fetch("/api/users/me");
            if (!response.ok) {
                return;
            }

            const profile = await response.json();
            const kakaoName = profile.userName ?? "";
            nameInput.value = kakaoName;
            applyEmailToInputs(profile.email ?? "");
            phoneInput.value = profile.phoneNumber ?? "";
            caregiverLicenseNumberInput.value = formatCaregiverLicenseNumber(profile.caregiverLicenseNumber);
            organizationNameInput.value = profile.organizationName ?? "";
            const loadedProfile = getCurrentProfile();
            originalProfile = {
                ...originalProfile,
                name: kakaoName,
                emailId: loadedProfile.emailId,
                emailDomain: loadedProfile.emailDomain,
                emailDomainCustom: loadedProfile.emailDomainCustom,
                phone: loadedProfile.phone,
                caregiverLicenseNumber: loadedProfile.caregiverLicenseNumber,
                organizationName: loadedProfile.organizationName
            };
        } catch (error) {
            console.error(error);
        }
    };

    loadKakaoProfileName();

    // 이메일 도메인을 직접 입력할지 여부에 따라 추가 입력창을 보여주거나 숨긴다.
    domainSelect.addEventListener("change", () => {
        const isCustomDomain = domainSelect.value === "직접입력";
        customDomainInput.classList.toggle("hidden", !isCustomDomain);

        if (!isCustomDomain) {
            customDomainInput.value = "";
        }
    });

    // 전화번호는 숫자만 최대 11자리까지 허용하고, 3-4-4 중심으로 하이픈을 자동 입력한다.
    // 단, 서울 지역번호 02는 실제 번호 체계에 맞춰 2-4-4 또는 2-3-4 형식으로 처리한다.
    phoneInput.addEventListener("input", (event) => {
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
        } else {
            if (numbersOnly.length <= 3) {
                formattedValue = numbersOnly;
            } else if (numbersOnly.length <= 7) {
                formattedValue = `${numbersOnly.slice(0, 3)}-${numbersOnly.slice(3)}`;
            } else {
                formattedValue = `${numbersOnly.slice(0, 3)}-${numbersOnly.slice(3, 7)}-${numbersOnly.slice(7)}`;
            }
        }

        event.target.value = formattedValue;
    });

    saveButton.addEventListener("click", async () => {
        const currentProfile = getCurrentProfile();
        const hasEmailChange =
            currentProfile.emailId !== originalProfile.emailId ||
            currentProfile.emailDomain !== originalProfile.emailDomain ||
            currentProfile.emailDomainCustom !== originalProfile.emailDomainCustom;

        // 이메일 도메인을 직접 입력으로 두었으면 실제 도메인 값을 꼭 확인한다.
        if (hasEmailChange && currentProfile.emailDomain === "직접입력" && !currentProfile.emailDomainCustom) {
            alert("이메일 도메인을 입력해주세요.");
            customDomainInput.focus();
            return;
        }

        const email = resolveEmail(currentProfile);
        if (hasEmailChange && !email) {
            alert("이메일을 입력해주세요.");
            emailIdInput.focus();
            return;
        }

        // 세 항목 중 하나라도 달라졌는지 비교해서, 실제 변경이 있을 때만 저장하도록 한다.
        const hasAnyChange =
            currentProfile.emailId !== originalProfile.emailId ||
            currentProfile.emailDomain !== originalProfile.emailDomain ||
            currentProfile.emailDomainCustom !== originalProfile.emailDomainCustom ||
            currentProfile.phone !== originalProfile.phone ||
            currentProfile.caregiverLicenseNumber !== originalProfile.caregiverLicenseNumber ||
            currentProfile.organizationName !== originalProfile.organizationName;

        if (!hasAnyChange) {
            alert("변경된 내용이 없습니다.");
            return;
        }

        saveButton.disabled = true;

        try {
            const response = await fetch("/api/users/profile", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email,
                    phoneNumber: currentProfile.phone,
                    caregiverLicenseNumber: currentProfile.caregiverLicenseNumber,
                    organizationName: currentProfile.organizationName
                })
            });

            if (!response.ok) {
                throw new Error("profile_update_failed");
            }

            localStorage.setItem(storageKey, JSON.stringify(currentProfile));
            // 수정 완료 안내를 보여준 뒤 메인 페이지로 이동시켜 사용 흐름을 마무리한다.
            alert("수정이 완료되었습니다.");
            window.location.href = "/main";
        } catch (error) {
            console.error(error);
            alert("개인정보 수정 저장에 실패했습니다.");
            saveButton.disabled = false;
        }
    });

    withdrawButton.addEventListener("click", async () => {
        const shouldWithdraw = confirm(
            "\uc815\ub9d0 \ud0c8\ud1f4\ud558\uc2dc\uaca0\uc2b5\ub2c8\uae4c? \ud0c8\ud1f4 \ud6c4 \uacc4\uc815 \uc815\ubcf4\uac00 \uc0ad\uc81c\ub429\ub2c8\ub2e4."
        );

        if (!shouldWithdraw) {
            return;
        }

        withdrawButton.disabled = true;

        try {
            const response = await fetch("/api/users/me", {
                method: "DELETE"
            });

            if (response.status === 401) {
                alert("\ub85c\uadf8\uc778 \uc138\uc158\uc774 \uc5c6\uc2b5\ub2c8\ub2e4. \ub2e4\uc2dc \ub85c\uadf8\uc778\ud55c \ub4a4 \ud0c8\ud1f4\ub97c \uc9c4\ud589\ud574 \uc8fc\uc138\uc694.");
                localStorage.removeItem("isLoggedIn");
                window.location.href = "/login";
                return;
            }

            if (response.status === 404) {
                alert("\ud0c8\ud1f4 API\uac00 \uc11c\ubc84\uc5d0 \ubc18\uc601\ub418\uc9c0 \uc54a\uc558\uc2b5\ub2c8\ub2e4. \uc11c\ubc84\ub97c \uc7ac\uc2dc\uc791\ud55c \ub4a4 \ub2e4\uc2dc \uc2dc\ub3c4\ud574 \uc8fc\uc138\uc694.");
                return;
            }

            if (!response.ok) {
                throw new Error(`Failed to withdraw. status=${response.status}`);
            }

            localStorage.removeItem(storageKey);
            localStorage.removeItem("isLoggedIn");
            alert("\ud0c8\ud1f4\uac00 \uc644\ub8cc\ub418\uc5c8\uc2b5\ub2c8\ub2e4.");
            window.location.href = "/login";
        } catch (error) {
            console.error(error);
            alert("\ud0c8\ud1f4 \ucc98\ub9ac \uc911 \ubb38\uc81c\uac00 \ubc1c\uc0dd\ud588\uc2b5\ub2c8\ub2e4.");
            withdrawButton.disabled = false;
        }
    });
});
