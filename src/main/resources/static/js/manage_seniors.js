// 수급자 관리 목록 페이지 전용 스크립트.
// 브라우저는 기존처럼 /api/recipients를 호출하고, 서버가 현재 로그인한 사용자와 연결된 수급자만 반환한다.
document.addEventListener("DOMContentLoaded", async () => {
    const searchInput = document.getElementById("recipient-search-input");
    const searchButton = document.getElementById("recipient-search-button");
    const listContainer = document.getElementById("recipient-list-container");

    let recipients = [];

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

    // 검색 버튼 클릭과 Enter 입력 모두 같은 검색 함수를 사용한다.
    const runSearch = () => renderRecipients(searchInput.value);

    searchButton.addEventListener("click", runSearch);
    searchInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            runSearch();
        }
    });

    await loadRecipients();
});
