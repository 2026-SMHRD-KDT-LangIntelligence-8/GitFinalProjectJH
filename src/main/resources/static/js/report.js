let latestReportChart = null;
let trendReportChart = null;

function buildPendingStatusMessage(recipientName, latestTestDate) {
    const latestLabel = latestTestDate ? `${latestTestDate} 검사 기록 확인 완료` : "검사 기록 확인 완료";
    return [
        `1단계 ${latestLabel}`,
        "2단계 음성 텍스트 변환과 문항 분석을 진행 중입니다.",
        "3단계 검사 분석 리포트와 기간별 변화 그래프를 생성하는 중입니다.",
        "예상 대기 시간은 약 1~3분입니다."
    ].join("\n");
}

async function fetchRecipientDetail(recipientId) {
    const response = await fetch(`/api/recipients/${recipientId}/detail`);
    if (!response.ok) {
        throw new Error("recipient_detail_failed");
    }
    return response.json();
}

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

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\"", "&quot;")
        .replaceAll("'", "&#39;");
}

function normalizeText(value) {
    return String(value ?? "")
        .replace(/\s+/g, " ")
        .trim();
}

function normalizeQuestionTypeName(value) {
    return String(value ?? "")
        .replace(/\s+/g, "")
        .trim();
}

function formatScore(score) {
    const numericScore = Number(score ?? 0);
    return Number.isInteger(numericScore) ? `${numericScore}` : numericScore.toFixed(1);
}

function formatDaysLabel(days) {
    switch (days) {
        case 3: return "3일";
        case 7: return "1주일";
        case 14: return "2주";
        case 30: return "1개월";
        case 60: return "2개월";
        case 90: return "3개월";
        default: return `${days}일`;
    }
}

function getFilterLabel(button) {
    return normalizeText(button?.dataset?.reportFilter || button?.textContent || "");
}

function isAllFilter(filterLabel) {
    const normalized = normalizeQuestionTypeName(filterLabel).toLowerCase();
    return normalized === "all" || normalized === "전체";
}

function getAllReportFilterButton(buttons) {
    return buttons.find((button) => isAllFilter(getFilterLabel(button))) || buttons[0] || null;
}

function getSelectedReportFilter(buttons) {
    const activeButton = buttons.find((button) => button.classList.contains("is-active")) || getAllReportFilterButton(buttons);
    return getFilterLabel(activeButton);
}

function setActiveReportFilter(buttons, activeButton) {
    if (!activeButton) {
        return;
    }

    buttons.forEach((button) => {
        const isActive = button === activeButton;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
    });
}

function filterQuestionTypeScores(scores, filterLabel) {
    if (isAllFilter(filterLabel)) {
        return scores;
    }

    const targetName = normalizeQuestionTypeName(filterLabel);
    return scores.filter((item) => normalizeQuestionTypeName(item.questionTypeName) === targetName);
}

function extractTrendScore(point, filterLabel) {
    if (isAllFilter(filterLabel)) {
        return Number(point.averageScore ?? 0);
    }

    const targetName = normalizeQuestionTypeName(filterLabel);
    const matchedItem = (point.questionTypeScores || []).find(
        (item) => normalizeQuestionTypeName(item.questionTypeName) === targetName
    );

    if (!matchedItem) {
        return null;
    }

    return Number(matchedItem.averageScore ?? 0);
}

function buildTrendSeries(points, filterLabel) {
    return {
        labels: points.map((point) => point.performedDate),
        scores: points.map((point) => extractTrendScore(point, filterLabel))
    };
}

function renderLatestChart(scores, filterLabel = "전체") {
    const context = document.getElementById("latest-report-chart");
    if (!context) {
        return;
    }

    if (latestReportChart) {
        latestReportChart.destroy();
    }

    const filteredScores = filterQuestionTypeScores(scores, filterLabel);

    latestReportChart = new Chart(context, {
        type: "bar",
        data: {
            labels: filteredScores.map((item) => item.questionTypeName),
            datasets: [{
                label: "평균 점수",
                data: filteredScores.map((item) => item.averageScore),
                backgroundColor: filteredScores.map((item) => item.trainingNeeded ? "#F94144" : "#14AE5C"),
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
                },
                tooltip: {
                    callbacks: {
                        label(context) {
                            const score = Number(context.raw ?? 0);
                            return score < 60
                                ? `평균 점수 ${formatScore(score)}점 / 훈련 필요`
                                : `평균 점수 ${formatScore(score)}점 / 안정`;
                        }
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

function renderTrendChart(points, filterLabel = "전체") {
    const context = document.getElementById("trend-report-chart");
    if (!context) {
        return;
    }

    if (trendReportChart) {
        trendReportChart.destroy();
    }

    const series = buildTrendSeries(points, filterLabel);

    trendReportChart = new Chart(context, {
        type: "line",
        data: {
            labels: series.labels,
            datasets: [{
                label: isAllFilter(filterLabel) ? "검사일별 평균 점수" : `${filterLabel} 점수`,
                data: series.scores,
                borderColor: "#277DA1",
                backgroundColor: "rgba(39, 125, 161, 0.18)",
                pointBackgroundColor: series.scores.map((score) => score !== null && score < 60 ? "#F94144" : "#14AE5C"),
                pointBorderColor: series.scores.map((score) => score !== null && score < 60 ? "#F94144" : "#14AE5C"),
                pointRadius: 4,
                pointHoverRadius: 5,
                fill: true,
                tension: 0.3,
                spanGaps: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label(context) {
                            const score = context.raw;
                            if (score === null || score === undefined) {
                                return "해당 문항 타입 점수 없음";
                            }

                            return Number(score) < 60
                                ? `평균 점수 ${formatScore(score)}점 / 훈련 필요`
                                : `평균 점수 ${formatScore(score)}점 / 안정`;
                        }
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

function clearTrendFeedback() {
    const element = document.getElementById("trend-feedback");
    if (element) {
        element.textContent = "";
    }
}

// 선택한 유형/기간의 점수 변화를 규칙 기반으로 요약한 피드백 문구를 만든다. (LLM 미사용)
// 의료 진단을 단정하는 표현은 쓰지 않고, 변화 관찰·담당자 공유 위주로 안내한다.
function renderTrendFeedback(points, filterLabel, days) {
    const element = document.getElementById("trend-feedback");
    if (!element) {
        return;
    }

    const round1 = (value) => Math.round(value * 10) / 10;
    const periodLabel = formatDaysLabel(days);
    const label = isAllFilter(filterLabel) ? "전체 평균" : `'${filterLabel}'`;

    const series = buildTrendSeries(points, filterLabel).scores
        .filter((score) => score !== null && score !== undefined)
        .map((score) => Number(score));

    if (series.length === 0) {
        element.textContent = `최근 ${periodLabel} 동안 ${label} 점수 데이터가 없습니다.`;
        return;
    }
    if (series.length === 1) {
        element.textContent = `최근 ${periodLabel} 동안 ${label} 검사가 1회뿐이라 추세를 비교할 수 없습니다. (현재 ${round1(series[0])}점)`;
        return;
    }

    const first = series[0];
    const last = series[series.length - 1];
    const delta = round1(last - first);
    const drop = round1(first - last);                              // 양수면 하락폭
    const avg = round1(series.reduce((sum, value) => sum + value, 0) / series.length);
    const dropPct = first > 0 ? Math.round((first - last) / first * 100) : 0;
    const isShort = days <= 14;                                     // 3일·1주·2주 = 단기
    const flow = `${round1(first)}점 → ${round1(last)}점`;

    let text;
    if (delta >= 3) {
        // 상승: 얼마나 올랐는지 알려준다.
        text = `최근 ${periodLabel} 동안 ${label} 점수가 ${flow}으로 ${Math.abs(delta)}점 올랐습니다. 평균 ${avg}점으로 좋은 흐름입니다.`;
        if (!isShort) {
            text += " 길게 봐도 우상향이라 긍정적입니다.";
        }
    } else if (isShort) {
        // 단기(3일·1주·2주): 5점 이내 변동은 정상, 6점 이상부터 관찰, 15점 이상 또는 절반 하락은 강한 안내.
        if (delta > -6) {
            text = `최근 ${periodLabel} 동안 ${label} 점수가 평균 ${avg}점으로 큰 변화 없이 유지되고 있습니다. 며칠 사이의 작은 등락은 컨디션·집중도에 따른 자연스러운 차이입니다.`;
        } else if (dropPct >= 50 || drop >= 15) {
            text = `최근 ${periodLabel}의 짧은 기간에 ${label} 점수가 ${flow}으로 ${drop}점(약 ${dropPct}%) 낮아졌습니다. 변동 폭이 큰 편이니, 최근 상태와 변화 내용을 담당 선생님(보호자)과 함께 살펴보시길 권합니다.`;
        } else {
            text = `최근 ${periodLabel} 동안 ${label} 점수가 ${flow}으로 ${drop}점 낮아졌습니다(평균 ${avg}점). 일시적인 변동일 수 있으니 다음 검사 결과를 함께 지켜봐 주세요.`;
        }
    } else {
        // 중장기(1개월·2개월·3개월): 8점 이내 변동은 안정, 9점 이상 완만한 하락, 20점 이상 또는 절반 하락은 강한 안내.
        if (delta > -9) {
            text = `최근 ${periodLabel} 동안 ${label} 점수가 평균 ${avg}점 안팎으로 안정적으로 유지되고 있습니다. 이 정도의 오르내림은 자연스러운 변동입니다.`;
        } else if (dropPct >= 50 || drop >= 20) {
            text = `최근 ${periodLabel} 동안 ${label} 점수가 ${flow}으로 ${drop}점(약 ${dropPct}%) 낮아졌습니다(평균 ${avg}점). 지속적인 하락 추세이니, 변화 내용을 담당 선생님(보호자)과 함께 살펴보시길 권합니다.`;
        } else {
            text = `최근 ${periodLabel} 동안 ${label} 점수가 ${flow}으로 ${drop}점가량 완만하게 낮아지는 추세입니다(평균 ${avg}점). 추세가 이어지는지 관심 있게 지켜봐 주세요.`;
        }
    }
    element.textContent = text;
}

function renderTypeSummary(scores, filterLabel = "전체") {
    const container = document.getElementById("report-type-summary");
    if (!container) {
        return;
    }

    const filteredScores = filterQuestionTypeScores(scores, filterLabel);
    container.innerHTML = filteredScores.map((item) => `
        <div class="report-type-summary-item">
            <span class="report-type-name">${escapeHtml(item.questionTypeName)}</span>
            <div class="report-type-meta">
                <span class="report-type-score">${formatScore(item.averageScore)}점</span>
                <span class="report-type-badge ${item.trainingNeeded ? "is-training-needed" : "is-stable"}">
                    ${item.trainingNeeded ? "훈련 필요" : "안정"}
                </span>
            </div>
        </div>
    `).join("");

    container.classList.toggle("hidden", filteredScores.length === 0);
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
    const trendSummaryHeader = document.getElementById("trend-summary-header");
    const reportTypeSummary = document.getElementById("report-type-summary");
    const latestReportFilterButtons = Array.from(document.querySelectorAll('[data-report-filter-scope="latest"]'));
    const trendReportFilterButtons = Array.from(document.querySelectorAll('[data-report-filter-scope="trend"]'));
    const downloadButtons = [
        document.getElementById("report-download-btn"),
        document.getElementById("trend-download-btn")
    ].filter(Boolean);
    const shareButtons = Array.from(document.querySelectorAll(".report-share-btn-js"));

    if (!searchInput || !searchToggleButton || !comboBox || !searchWrap || !historySelect || !trendSelect || !trendSummaryHeader || !reportTypeSummary) {
        return;
    }

    let recipients = [];
    let isLocked = false;
    let selectedRecipient = null;
    let latestQuestionTypeScores = [];
    let trendReportPoints = [];

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

    const closeCombo = () => {
        comboBox.classList.remove("is-open");
        comboBox.innerHTML = "";
    };

    const applyLatestReportFilter = () => {
        if (!latestQuestionTypeScores.length) {
            reportTypeSummary.innerHTML = "";
            reportTypeSummary.classList.add("hidden");
            setEmptyState(latestReportEmpty, true);
            if (latestReportChart) {
                latestReportChart.destroy();
                latestReportChart = null;
            }
            return;
        }

        const selectedFilter = getSelectedReportFilter(latestReportFilterButtons);
        const filteredScores = filterQuestionTypeScores(latestQuestionTypeScores, selectedFilter);

        if (!filteredScores.length) {
            reportTypeSummary.innerHTML = "";
            reportTypeSummary.classList.add("hidden");
            latestReportEmpty.textContent = "선택한 문항 타입의 점수가 없습니다.";
            setEmptyState(latestReportEmpty, true);
            if (latestReportChart) {
                latestReportChart.destroy();
                latestReportChart = null;
            }
            return;
        }

        setEmptyState(latestReportEmpty, false);
        renderLatestChart(latestQuestionTypeScores, selectedFilter);
        renderTypeSummary(latestQuestionTypeScores, selectedFilter);
    };

    const applyTrendReportFilter = () => {
        if (!trendReportPoints.length) {
            setEmptyState(trendReportEmpty, true);
            clearTrendFeedback();
            if (trendReportChart) {
                trendReportChart.destroy();
                trendReportChart = null;
            }
            return;
        }

        const selectedFilter = getSelectedReportFilter(trendReportFilterButtons);
        const series = buildTrendSeries(trendReportPoints, selectedFilter);
        const hasRenderableScore = series.scores.some((score) => score !== null && score !== undefined);

        if (!hasRenderableScore) {
            trendReportEmpty.textContent = "선택한 문항 타입의 기간별 점수가 없습니다.";
            setEmptyState(trendReportEmpty, true);
            clearTrendFeedback();
            if (trendReportChart) {
                trendReportChart.destroy();
                trendReportChart = null;
            }
            return;
        }

        setEmptyState(trendReportEmpty, false);
        renderTrendChart(trendReportPoints, selectedFilter);
        renderTrendFeedback(trendReportPoints, selectedFilter, Number(trendSelect.value));
    };

    const resetReportUi = (message) => {
        destroyCharts();
        historySelect.innerHTML = '<option value="">리포트 선택</option>';
        reportSummaryHeader.textContent = message;
        trendSummaryHeader.textContent = "최근 기간의 검사일별 평균 점수 변화를 표시합니다.";
        reportTypeSummary.innerHTML = "";
        reportTypeSummary.classList.add("hidden");
        latestQuestionTypeScores = [];
        trendReportPoints = [];
        latestReportEmpty.textContent = "검사 분석 결과가 아직 없습니다.";
        trendReportEmpty.textContent = "기간별 그래프로 표시할 검사 결과가 없습니다.";
        setActiveReportFilter(latestReportFilterButtons, getAllReportFilterButton(latestReportFilterButtons));
        setActiveReportFilter(trendReportFilterButtons, getAllReportFilterButton(trendReportFilterButtons));
        clearTrendFeedback();
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

        const matchedRecipients = recipients.filter((recipient) => (recipient.recipientName ?? "").includes(keyword));
        if (!matchedRecipients.length) {
            closeCombo();
            return;
        }

        comboBox.innerHTML = matchedRecipients.map((recipient) => `
            <button type="button" class="report-recipient-option" data-id="${recipient.recipientId}">
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

    const unlockSearchInput = () => {
        isLocked = false;
        selectedRecipient = null;
        searchInput.readOnly = false;
        searchWrap.classList.remove("is-locked");
        searchInput.removeAttribute("data-recipient-id");
        resetReportUi("수급자를 선택하면 최근 검사 리포트가 표시됩니다.");
        renderCombo();
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

    latestReportFilterButtons.forEach((button) => {
        button.addEventListener("click", () => {
            setActiveReportFilter(latestReportFilterButtons, button);
            applyLatestReportFilter();
        });
    });

    trendReportFilterButtons.forEach((button) => {
        button.addEventListener("click", () => {
            setActiveReportFilter(trendReportFilterButtons, button);
            applyTrendReportFilter();
        });
    });

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

    searchInput.addEventListener("click", () => {
        if (!isLocked) {
            return;
        }

        unlockSearchInput();
        searchInput.focus();
    });

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
            unlockSearchInput();
            searchInput.focus();
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
            const recipientDetail = await fetchRecipientDetail(recipientId).catch(() => null);
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

            if (!reports.length) {
                const hasExamHistory = Number(recipientDetail?.testCount ?? 0) > 0 || Boolean(recipientDetail?.latestTestDate);
                if (hasExamHistory) {
                    const pendingMessage = buildPendingStatusMessage(recipientName, recipientDetail?.latestTestDate);
                    reportSummaryHeader.textContent = `${recipientName} 님의 검사 기록은 확인되었고, 분석 결과를 정리 중입니다.`;
                    trendSummaryHeader.textContent = `${recipientName} 님의 훈련 현황과 기간별 변화도 분석 완료 후 함께 표시됩니다.`;
                    latestReportEmpty.textContent = pendingMessage;
                    trendReportEmpty.textContent = pendingMessage;
                } else {
                    reportSummaryHeader.textContent = `${recipientName} 님의 검사 분석 리포트가 아직 없습니다.`;
                    trendSummaryHeader.textContent = `${recipientName} 님의 기간별 평균 점수 추이가 아직 없습니다.`;
                    latestReportEmpty.textContent = "검사 분석 결과가 아직 없습니다.";
                    trendReportEmpty.textContent = "기간별 그래프로 표시할 검사 결과가 없습니다.";
                }

                reportTypeSummary.innerHTML = "";
                reportTypeSummary.classList.add("hidden");
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
                latestQuestionTypeScores = [];
                reportTypeSummary.innerHTML = "";
                reportTypeSummary.classList.add("hidden");
                setActiveReportFilter(latestReportFilterButtons, getAllReportFilterButton(latestReportFilterButtons));
                setEmptyState(latestReportEmpty, true);
                if (latestReportChart) {
                    latestReportChart.destroy();
                    latestReportChart = null;
                }
                return;
            }

            latestQuestionTypeScores = payload.questionTypeScores;
            applyLatestReportFilter();
        } catch (error) {
            console.error(error);
            latestQuestionTypeScores = [];
            reportTypeSummary.innerHTML = "";
            reportTypeSummary.classList.add("hidden");
            setActiveReportFilter(latestReportFilterButtons, getAllReportFilterButton(latestReportFilterButtons));
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
                trendSummaryHeader.textContent = `최근 ${formatDaysLabel(days)} 동안 표시할 평균 점수 데이터가 없습니다.`;
                trendReportPoints = [];
                setActiveReportFilter(trendReportFilterButtons, getAllReportFilterButton(trendReportFilterButtons));
                clearTrendFeedback();
                setEmptyState(trendReportEmpty, true);
                if (trendReportChart) {
                    trendReportChart.destroy();
                    trendReportChart = null;
                }
                return;
            }

            trendReportPoints = payload.points;
            trendSummaryHeader.textContent = `최근 ${formatDaysLabel(days)} 동안 검사일별 평균 점수 추이입니다.`;
            applyTrendReportFilter();
        } catch (error) {
            console.error(error);
            trendReportPoints = [];
            setActiveReportFilter(trendReportFilterButtons, getAllReportFilterButton(trendReportFilterButtons));
            clearTrendFeedback();
            trendSummaryHeader.textContent = "기간별 변화 추이를 불러오지 못했습니다.";
            setEmptyState(trendReportEmpty, true);
        }
    }
});
