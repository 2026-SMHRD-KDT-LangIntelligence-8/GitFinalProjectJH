let latestReportChart = null;
let trendReportChart = null;

function downloadPDF() {
    const element = document.getElementById("pdf-area");
    const recipientName = document.getElementById("report-recipient-search")?.value?.trim() || "리포트";

    const opt = {
        margin: 10,
        filename: `${recipientName}_리포트.pdf`,
        image: {type: "jpeg", quality: 0.98},
        html2canvas: {scale: 2, useCORS: true},
        jsPDF: {unit: "mm", format: "a4", orientation: "portrait"}
    };

    html2pdf().set(opt).from(element).save();
}

document.addEventListener("DOMContentLoaded", async () => {
    const searchInput = document.getElementById("report-recipient-search");
    const searchToggleButton = document.getElementById("report-search-toggle");
    const comboBox = document.getElementById("report-recipient-combo");
    const searchWrap = document.querySelector(".report-search-wrap");
    const historySelect = document.getElementById("report-history-select");
    const trendSelect = document.getElementById("report-trend-select");
    const latestReportEmpty = document.getElementById("latest-report-empty");
    const trendReportEmpty = document.getElementById("trend-report-empty");
    const reportSummaryHeader = document.getElementById("report-summary-header");
    const downloadButtons = [
        document.getElementById("report-download-btn"),
        document.getElementById("trend-download-btn")
    ].filter(Boolean);
    const shareButtons = Array.from(document.querySelectorAll(".report-share-btn-js"));

    if (!searchInput || !searchToggleButton || !comboBox || !searchWrap || !historySelect || !trendSelect) {
        return;
    }

    let recipients = [];
    let isLocked = false;
    let selectedRecipient = null;

    downloadButtons.forEach((button) => {
        button.addEventListener("click", downloadPDF);
    });

    shareButtons.forEach((button) => {
        button.addEventListener("click", async () => {
            if (!selectedRecipient || !historySelect.value) {
                alert("수급자와 리포트를 먼저 선택해주세요.");
                return;
            }

            try {
                const response = await fetch("/api/reports/share-links", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        recipientId: selectedRecipient.recipientId,
                        performanceId: Number(historySelect.value)
                    })
                });

                if (!response.ok) {
                    throw new Error("share_link_create_failed");
                }

                const payload = await response.json();

                if (navigator.share) {
                    await navigator.share({
                        title: payload.title,
                        text: payload.description,
                        url: payload.shareUrl
                    });
                    return;
                }

                if (navigator.clipboard?.writeText) {
                    await navigator.clipboard.writeText(payload.shareUrl);
                    alert(`공유 링크를 복사했습니다.\n${payload.shareUrl}`);
                    return;
                }

                prompt("공유 링크를 복사해주세요.", payload.shareUrl);
            } catch (error) {
                console.error(error);
                alert("공유 링크를 만들지 못했습니다.");
            }
        });
    });

    const closeCombo = () => {
        comboBox.classList.remove("is-open");
        comboBox.innerHTML = "";
    };

    const setEmptyState = (element, visible) => {
        element.classList.toggle("is-visible", visible);
    };

    const destroyCharts = () => {
        if (latestReportChart) {
            latestReportChart.destroy();
            latestReportChart = null;
        }

        if (trendReportChart) {
            trendReportChart.destroy();
            trendReportChart = null;
        }
    };

    const resetReportUi = (message) => {
        destroyCharts();
        historySelect.innerHTML = '<option value="">리포트 선택</option>';
        reportSummaryHeader.textContent = message;
        setEmptyState(latestReportEmpty, true);
        setEmptyState(trendReportEmpty, true);
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
            <button
                type="button"
                class="report-recipient-option"
                data-id="${recipient.recipientId}"
            >
                ${escapeHtml(recipient.recipientName)}
            </button>
        `).join("");

        comboBox.classList.add("is-open");
    };

    const resolveSelectedRecipient = () => {
        const typedName = searchInput.value.trim();
        if (!typedName) {
            return null;
        }

        if (selectedRecipient && selectedRecipient.recipientName === typedName) {
            return selectedRecipient;
        }

        return recipients.find((recipient) => recipient.recipientName === typedName) ?? null;
    };

    const lockSearchInput = async () => {
        const recipient = resolveSelectedRecipient();
        if (!recipient) {
            alert("목록에서 수급자를 선택해주세요.");
            searchInput.focus();
            return;
        }

        selectedRecipient = recipient;
        searchInput.value = recipient.recipientName;
        isLocked = true;
        searchInput.readOnly = true;
        searchWrap.classList.add("is-locked");
        closeCombo();

        await loadReportsForRecipient(recipient.recipientId, recipient.recipientName);
    };

    try {
        const response = await fetch("/api/recipients");
        if (!response.ok) {
            throw new Error("recipient_fetch_failed");
        }

        recipients = await response.json();
    } catch (error) {
        console.error(error);
        resetReportUi("수급자 목록을 불러오지 못했습니다.");
        return;
    }

    searchInput.addEventListener("input", () => {
        selectedRecipient = null;
        renderCombo();
    });
    searchInput.addEventListener("focus", renderCombo);
    searchInput.addEventListener("keydown", async (event) => {
        if (event.key !== "Enter") {
            return;
        }

        event.preventDefault();

        if (!isLocked) {
            await lockSearchInput();
        }
    });

    searchToggleButton.addEventListener("click", async () => {
        if (isLocked) {
            isLocked = false;
            selectedRecipient = null;
            searchInput.readOnly = false;
            searchWrap.classList.remove("is-locked");
            searchInput.removeAttribute("data-recipient-id");
            searchInput.focus();
            resetReportUi("수급자를 선택하면 최근 검사 리포트가 표시됩니다.");
            renderCombo();
            return;
        }

        await lockSearchInput();
    });

    comboBox.addEventListener("click", async (event) => {
        const option = event.target.closest(".report-recipient-option");
        if (!option) {
            return;
        }

        const recipientId = Number(option.dataset.id);
        selectedRecipient = recipients.find((recipient) => recipient.recipientId === recipientId) ?? null;
        searchInput.value = selectedRecipient?.recipientName ?? "";
        closeCombo();
        await lockSearchInput();
    });

    document.addEventListener("click", (event) => {
        if (!event.target.closest(".report-search-wrap")) {
            closeCombo();
        }
    });

    historySelect.addEventListener("change", async () => {
        if (!selectedRecipient || !historySelect.value) {
            return;
        }

        await loadLatestReport(selectedRecipient.recipientId, historySelect.value);
    });

    trendSelect.addEventListener("change", async () => {
        if (!selectedRecipient) {
            return;
        }

        await loadTrendReport(selectedRecipient.recipientId, Number(trendSelect.value));
    });

    resetReportUi("수급자를 선택하면 최근 검사 리포트가 표시됩니다.");

    async function loadReportsForRecipient(recipientId, recipientName) {
        try {
            const response = await fetch(`/api/reports/recipients/${recipientId}/performances`);
            if (!response.ok) {
                throw new Error("report_list_failed");
            }

            const reports = await response.json();
            historySelect.innerHTML = '<option value="">리포트 선택</option>';

            reports.forEach((report, index) => {
                const option = document.createElement("option");
                option.value = String(report.performanceId);
                option.textContent = index === 0 ? `최근 리포트 (${report.performedAt})` : report.performedAt;
                historySelect.appendChild(option);
            });

            if (reports.length === 0) {
                reportSummaryHeader.textContent = `${recipientName} 님의 검사 분석 리포트가 아직 없습니다.`;
                setEmptyState(latestReportEmpty, true);
                setEmptyState(trendReportEmpty, true);
                destroyCharts();
                return;
            }

            historySelect.value = String(reports[0].performanceId);
            await loadLatestReport(recipientId, reports[0].performanceId);
            await loadTrendReport(recipientId, Number(trendSelect.value));
        } catch (error) {
            console.error(error);
            resetReportUi("리포트 데이터를 불러오지 못했습니다.");
        }
    }

    async function loadLatestReport(recipientId, performanceId) {
        try {
            const response = await fetch(`/api/reports/recipients/${recipientId}/performances/${performanceId}`);
            if (!response.ok) {
                throw new Error("latest_report_failed");
            }

            const payload = await response.json();
            reportSummaryHeader.textContent = payload.performedAt
                ? `${payload.recipientName} 님의 ${payload.performedAt} 검사 결과입니다.`
                : `${payload.recipientName} 님의 검사 결과입니다.`;

            if (!payload.questionTypeScores?.length) {
                if (latestReportChart) {
                    latestReportChart.destroy();
                    latestReportChart = null;
                }
                setEmptyState(latestReportEmpty, true);
                return;
            }

            setEmptyState(latestReportEmpty, false);
            renderLatestChart(payload.questionTypeScores);
        } catch (error) {
            console.error(error);
            setEmptyState(latestReportEmpty, true);
        }
    }

    async function loadTrendReport(recipientId, days) {
        try {
            const response = await fetch(`/api/reports/recipients/${recipientId}/trend?days=${days}`);
            if (!response.ok) {
                throw new Error("trend_report_failed");
            }

            const payload = await response.json();
            if (!payload.points?.length) {
                if (trendReportChart) {
                    trendReportChart.destroy();
                    trendReportChart = null;
                }
                setEmptyState(trendReportEmpty, true);
                return;
            }

            setEmptyState(trendReportEmpty, false);
            renderTrendChart(payload.points);
        } catch (error) {
            console.error(error);
            setEmptyState(trendReportEmpty, true);
        }
    }
});

function renderLatestChart(scores) {
    const context = document.getElementById("latest-report-chart");
    if (!context) {
        return;
    }

    if (latestReportChart) {
        latestReportChart.destroy();
    }

    latestReportChart = new Chart(context, {
        type: "bar",
        data: {
            labels: scores.map((item) => item.questionTypeName),
            datasets: [{
                label: "평균 점수",
                data: scores.map((item) => item.averageScore),
                backgroundColor: ["#14AE5C", "#277DA1", "#F77F00", "#73508F", "#F94144"],
                borderRadius: 12,
                maxBarThickness: 38
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    min: 0,
                    max: 100,
                    ticks: {
                        stepSize: 20
                    }
                }
            }
        }
    });
}

function renderTrendChart(points) {
    const context = document.getElementById("trend-report-chart");
    if (!context) {
        return;
    }

    if (trendReportChart) {
        trendReportChart.destroy();
    }

    const labels = [...new Set(points.map((point) => point.performedDate))];
    const questionTypes = [...new Set(points.map((point) => point.questionTypeName))];
    const colorPalette = ["#14AE5C", "#277DA1", "#F77F00", "#73508F", "#F94144"];

    const datasets = questionTypes.map((questionTypeName, index) => ({
        label: questionTypeName,
        data: labels.map((date) => {
            const point = points.find((item) =>
                item.performedDate === date && item.questionTypeName === questionTypeName
            );
            return point ? point.averageScore : null;
        }),
        borderColor: colorPalette[index % colorPalette.length],
        backgroundColor: colorPalette[index % colorPalette.length],
        tension: 0.3,
        spanGaps: true
    }));

    trendReportChart = new Chart(context, {
        type: "line",
        data: {
            labels,
            datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: "bottom",
                    labels: {
                        boxWidth: 10,
                        usePointStyle: true
                    }
                }
            },
            scales: {
                y: {
                    min: 0,
                    max: 100,
                    ticks: {
                        stepSize: 20
                    }
                }
            }
        }
    });
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\"", "&quot;")
        .replaceAll("'", "&#39;");
}
