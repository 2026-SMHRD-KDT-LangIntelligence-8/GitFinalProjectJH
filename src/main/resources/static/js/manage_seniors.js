// 수급자 관리 목록 페이지 전용 스크립트.
// 브라우저는 기존처럼 /api/recipients를 호출하고, 서버가 현재 로그인한 사용자와 연결된 수급자만 반환한다.
document.addEventListener("DOMContentLoaded", async () => {
    const searchInput = document.getElementById("recipient-search-input");
    const searchButton = document.getElementById("recipient-search-button");
    const suggestionBox = document.getElementById("recipient-suggestion-box");
    const listContainer = document.getElementById("recipient-list-container");
    const addButton = document.getElementById("recipient-add-button");
    const consentModal = document.getElementById("privacy-consent-modal");
    const consentCheckbox = document.getElementById("privacy-consent-checkbox");
    const consentConfirmButton = document.getElementById("privacy-consent-confirm-button");
    const consentCancelButton = document.getElementById("privacy-consent-cancel-button");

    let recipients = [];

    const escapeHtml = (value) => String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\"", "&quot;")
        .replaceAll("'", "&#039;");

    const renderRecipients = (keyword = "") => {
        const normalizedKeyword = keyword.trim();
        const filteredRecipients = recipients.filter((recipient) =>
            recipient.recipientName.includes(normalizedKeyword)
        );

        if (filteredRecipients.length === 0) {
            listContainer.innerHTML = `
                <div class="recipient-empty-message">
                    조회된 수급자가 없습니다.
                </div>
            `;
            return;
        }

        listContainer.innerHTML = filteredRecipients.map((recipient) => `
            <a class="recipient-row" href="/manage-seniors/detail?recipientId=${recipient.recipientId}">
                <span class="recipient-cell w-name">${recipient.recipientName ?? ""}</span>
                <span class="recipient-cell w-birth">${recipient.birthDate ?? ""}</span>
                <span class="recipient-cell w-gender">${recipient.gender ?? ""}</span>
                <span class="recipient-cell w-grade">${recipient.careGrade ?? ""}</span>
            </a>
        `).join("");
    };

    const loadRecipients = async () => {
        try {
            const response = await fetch("/api/recipients");
            if (!response.ok) {
                throw new Error("수급자 목록 조회 실패");
            }

            recipients = await response.json();
            renderRecipients();
        } catch (error) {
            listContainer.innerHTML = `
                <div class="recipient-empty-message">
                    수급자 목록을 불러오지 못했습니다.
                </div>
            `;
            console.error(error);
        }
    };

    const hideSuggestions = () => {
        if (!suggestionBox) {
            return;
        }

        suggestionBox.classList.add("hidden");
        suggestionBox.innerHTML = "";
    };

    const renderSuggestions = () => {
        if (!suggestionBox) {
            return;
        }

        const keyword = searchInput.value.trim();
        if (!keyword) {
            hideSuggestions();
            return;
        }

        const matchedRecipients = recipients.filter((recipient) =>
            (recipient.recipientName ?? "").includes(keyword)
        );

        if (matchedRecipients.length === 0) {
            hideSuggestions();
            return;
        }

        suggestionBox.innerHTML = matchedRecipients.map((recipient) => `
            <button type="button" class="recipient-suggestion-item" data-recipient-id="${recipient.recipientId}">
                ${escapeHtml(recipient.recipientName)}
            </button>
        `).join("");
        suggestionBox.classList.remove("hidden");
    };

    // 검색 버튼 클릭과 Enter 입력 모두 같은 검색 함수를 사용한다.
    const runSearch = () => {
        renderRecipients(searchInput.value);
        hideSuggestions();
    };

    searchButton.addEventListener("click", runSearch);
    searchInput.addEventListener("input", renderSuggestions);
    searchInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            runSearch();
        }

        if (event.key === "Escape") {
            hideSuggestions();
        }
    });

    suggestionBox?.addEventListener("click", (event) => {
        const item = event.target.closest(".recipient-suggestion-item");
        if (!item) {
            return;
        }

        window.location.href = `/manage-seniors/detail?recipientId=${item.dataset.recipientId}`;
    });

    document.addEventListener("click", (event) => {
        if (event.target.closest(".recipient-search-field")) {
            return;
        }

        hideSuggestions();
    });

    if (addButton && consentModal && consentCheckbox && consentConfirmButton && consentCancelButton) {
        const openConsentModal = () => {
            consentCheckbox.checked = false;
            consentConfirmButton.disabled = true;
            consentModal.classList.remove("hidden");
            consentCheckbox.focus();
        };

        const closeConsentModal = () => {
            consentModal.classList.add("hidden");
            addButton.focus();
        };

        addButton.addEventListener("click", (event) => {
            event.preventDefault();
            openConsentModal();
        });

        consentCheckbox.addEventListener("change", () => {
            consentConfirmButton.disabled = !consentCheckbox.checked;
        });

        consentCancelButton.addEventListener("click", closeConsentModal);

        consentConfirmButton.addEventListener("click", () => {
            if (!consentCheckbox.checked) {
                return;
            }

            window.location.href = addButton.href;
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && !consentModal.classList.contains("hidden")) {
                closeConsentModal();
            }
        });
    }

    await loadRecipients();
});
