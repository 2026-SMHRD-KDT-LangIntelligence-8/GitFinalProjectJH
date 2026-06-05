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
    const saveButton = document.getElementById("profile-save-button");

    const defaultProfile = {
        name: "",
        emailId: "",
        emailDomain: "naver.com",
        emailDomainCustom: "",
        phone: ""
    };

    // 현재 입력 상태를 하나의 객체로 모아두면 변경 여부 비교와 저장 처리가 단순해진다.
    const getCurrentProfile = () => ({
        name: nameInput.value.trim(),
        emailId: emailIdInput.value.trim(),
        emailDomain: domainSelect.value,
        emailDomainCustom: customDomainInput.value.trim(),
        phone: phoneInput.value.trim()
    });

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

        const isCustomDomain = domainSelect.value === "직접입력";
        customDomainInput.classList.toggle("hidden", !isCustomDomain);
    };

    const originalProfile = loadSavedProfile();
    applyProfileToInputs(originalProfile);

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

    saveButton.addEventListener("click", () => {
        const currentProfile = getCurrentProfile();

        // 이메일 도메인을 직접 입력으로 두었으면 실제 도메인 값을 꼭 확인한다.
        if (currentProfile.emailDomain === "직접입력" && !currentProfile.emailDomainCustom) {
            alert("이메일 도메인을 입력해주세요.");
            customDomainInput.focus();
            return;
        }

        // 세 항목 중 하나라도 달라졌는지 비교해서, 실제 변경이 있을 때만 저장하도록 한다.
        const hasAnyChange =
            currentProfile.name !== originalProfile.name ||
            currentProfile.emailId !== originalProfile.emailId ||
            currentProfile.emailDomain !== originalProfile.emailDomain ||
            currentProfile.emailDomainCustom !== originalProfile.emailDomainCustom ||
            currentProfile.phone !== originalProfile.phone;

        if (!hasAnyChange) {
            alert("변경된 내용이 없습니다.");
            return;
        }

        localStorage.setItem(storageKey, JSON.stringify(currentProfile));
        // 수정 완료 안내를 보여준 뒤 메인 페이지로 이동시켜 사용 흐름을 마무리한다.
        alert("수정이 완료되었습니다.");
        window.location.href = "/main";
    });
});
