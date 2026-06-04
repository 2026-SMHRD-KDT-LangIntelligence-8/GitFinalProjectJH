// 수급자 관리 목록 화면 전용 스크립트.
// RECIPIENTS 테이블에서 조회한 데이터를 목록으로 보여주고, 이름 검색도 클라이언트에서 처리한다.
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

    // 검색 버튼과 Enter 입력 모두 같은 필터 함수를 사용한다.
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
