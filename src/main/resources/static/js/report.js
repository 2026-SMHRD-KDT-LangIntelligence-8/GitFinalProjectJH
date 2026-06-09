// 리포트 영역을 PDF로 내보내는 기능을 담당한다.
// 외부 html2pdf 라이브러리를 사용해 화면 내용을 그대로 저장한다.
function downloadPDF() {
    const element = document.getElementById("pdf-area");

    const opt = {
        margin: 10,
        filename: "리포트_출력.pdf",
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
    };

    html2pdf().set(opt).from(element).save().then(() => {
        console.log("PDF 다운로드 완료");
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    const searchInput = document.getElementById("report-recipient-search");
    const searchToggleButton = document.getElementById("report-search-toggle");
    const comboBox = document.getElementById("report-recipient-combo");
    const searchWrap = document.querySelector(".report-search-wrap");

    if (!searchInput || !searchToggleButton || !comboBox || !searchWrap) {
        return;
    }

    let recipients = [];
    let isLocked = false;

    const closeCombo = () => {
        comboBox.classList.remove("is-open");
        comboBox.innerHTML = "";
    };

    const renderCombo = () => {
        if (isLocked) {
            closeCombo();
            return;
        }

        const keyword = searchInput.value.trim();

        if (!keyword) {
            closeCombo();
            return;
        }

        const matchedRecipients = recipients.filter((recipient) =>
            (recipient.recipientName ?? "").includes(keyword)
        );

        if (matchedRecipients.length === 0) {
            closeCombo();
            return;
        }

        comboBox.innerHTML = matchedRecipients.map((recipient) => `
            <button type="button" class="report-recipient-option" data-name="${escapeHtml(recipient.recipientName)}">
                ${escapeHtml(recipient.recipientName)}
            </button>
        `).join("");
        comboBox.classList.add("is-open");
    };

    const lockSearchInput = () => {
        if (!searchInput.value.trim()) {
            searchInput.focus();
            return;
        }

        isLocked = true;
        searchInput.readOnly = true;
        searchWrap.classList.add("is-locked");
        closeCombo();
    };

    try {
        const response = await fetch("/api/recipients");
        if (!response.ok) {
            throw new Error("수급자 목록 조회 실패");
        }

        recipients = await response.json();
    } catch (error) {
        console.error(error);
    }

    searchInput.addEventListener("input", renderCombo);
    searchInput.addEventListener("focus", renderCombo);
    searchInput.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") {
            return;
        }

        event.preventDefault();

        if (!isLocked) {
            lockSearchInput();
        }
    });

    searchToggleButton.addEventListener("click", () => {
        if (isLocked) {
            isLocked = false;
            searchInput.readOnly = false;
            searchWrap.classList.remove("is-locked");
            searchInput.focus();
            renderCombo();
            return;
        }

        lockSearchInput();
    });

    comboBox.addEventListener("click", (event) => {
        const option = event.target.closest(".report-recipient-option");

        if (!option) {
            return;
        }

        searchInput.value = option.dataset.name;
        closeCombo();
        searchInput.focus();
    });

    document.addEventListener("click", (event) => {
        if (!event.target.closest(".report-search-wrap")) {
            closeCombo();
        }
    });
});

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\"", "&quot;")
        .replaceAll("'", "&#39;");
}
