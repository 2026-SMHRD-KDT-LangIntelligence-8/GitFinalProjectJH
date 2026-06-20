let latestReportChart = null;
let trendReportChart = null;

const QUESTION_TYPE_ORDER = [
    "오늘 날짜 말하기",
    "그림 설명하기",
    "상황 질문 답하기",
    "규칙 기반 언어추론",
    "추억 말하기"
];

function buildCompleteQuestionTypeScores(scores = []) {
    const scoreMap = new Map(
        scores.map((item) => [normalizeQuestionTypeName(item.questionTypeName), item])
    );

    return QUESTION_TYPE_ORDER.map((questionTypeName) => {
        const matchedItem = scoreMap.get(normalizeQuestionTypeName(questionTypeName));
        if (matchedItem) {
            return matchedItem;
        }

        return {
            questionTypeName,
            averageScore: 0,
            trainingNeeded: true,
            isMissingScore: true
        };
    });
}

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
        throw new Error(`recipient_detail_failed_${response.status}`);
    }

    return response.json();
}

function waitForPaint() {
    return new Promise((resolve) => {
        requestAnimationFrame(() => {
            requestAnimationFrame(resolve);
        });
    });
}

function getChartsForSection(sectionId) {
    if (sectionId === "trend-report-section") {
        return [trendReportChart].filter(Boolean);
    }

    return [latestReportChart].filter(Boolean);
}

function resizeCharts(charts) {
    charts.forEach((chart) => {
        if (chart && typeof chart.resize === "function") {
            chart.resize();
        }
    });
}

function setChartDevicePixelRatio(charts, ratio) {
    const previousOptions = [];

    charts.forEach((chart) => {
        if (!chart || !chart.options) {
            return;
        }

        previousOptions.push({
            chart,
            devicePixelRatio: chart.options.devicePixelRatio
        });

        chart.options.devicePixelRatio = ratio;
        chart.resize();
        chart.update("none");
    });

    return () => {
        previousOptions.forEach(({ chart, devicePixelRatio }) => {
            chart.options.devicePixelRatio = devicePixelRatio;
            chart.resize();
            chart.update("none");
        });
    };
}

function sanitizePdfFileNamePart(value) {
    return String(value ?? "")
        .replace(/[\\/:*?"<>|]/g, "_")
        .trim();
}

function formatReportHistoryDate(value) {
    const raw = String(value ?? "").trim();
    const matched = raw.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/);
    if (!matched) {
        return raw;
    }

    const [, year, month, day, hour, minute] = matched;
    return `${year.slice(-2)}/${Number(month)}/${Number(day)}/${Number(hour)}/${Number(minute)}`;
}

function buildReportHistoryLabel(performedAt, reportType) {
    const formattedDate = formatReportHistoryDate(performedAt);
    const typeLabel = String(reportType ?? "").trim() || "검사";
    return `${formattedDate} - ${typeLabel}`;
}

function getCurrentPdfSectionLabel(sectionType) {
    const buttons = Array.from(
        document.querySelectorAll(`[data-report-filter-scope="${sectionType === "trend" ? "trend" : "latest"}"]`)
    );
    const selectedFilter = getSelectedReportFilter(buttons);
    return isAllFilter(selectedFilter) ? "전체" : normalizeQuestionTypeName(selectedFilter);
}

function buildPdfFileName(recipientName, sectionType) {
    const safeRecipientName = sanitizePdfFileNamePart(recipientName || "수급자");
    const safeSectionLabel = sanitizePdfFileNamePart(getCurrentPdfSectionLabel(sectionType) || "전체");
    return `${safeRecipientName}_${safeSectionLabel}.pdf`;
}

function triggerBlobDownload(blob, fileName) {
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
}

async function downloadPDF(sectionId = "latest-report-section", shouldReturnBlob = false, fileName = null) {
    const sourceSection = document.getElementById(sectionId);
    const recipientName = document.getElementById("report-recipient-search")?.value?.trim() || "???";

    if (!sourceSection) {
        alert("PDF? ??? ??? ??? ?? ?????.");
        return null;
    }

    const targetCharts = getChartsForSection(sectionId);
    sourceSection.classList.add("pdf-section-export-mode");

    await waitForPaint();
    const restoreChartDpr = setChartDevicePixelRatio(targetCharts, 4);
    await waitForPaint();
    resizeCharts(targetCharts);
    await waitForPaint();

    const opt = {
        margin: [8, 8, 10, 8],
        filename: fileName || `${sanitizePdfFileNamePart(recipientName)}_전체.pdf`,
        image: { type: "png", quality: 1 },
        html2canvas: {
            scale: 5,
            useCORS: true,
            backgroundColor: "#ffffff",
            scrollX: 0,
            scrollY: 0,
            windowWidth: document.documentElement.scrollWidth,
            windowHeight: document.documentElement.scrollHeight
        },
        jsPDF: {
            unit: "mm",
            format: "a4",
            orientation: "portrait"
        },
        pagebreak: {
            mode: ["css", "legacy"],
            avoid: [".report-card-panel", ".report-type-summary-item", ".report-chart-wrap"]
        }
    };

    try {
        if (shouldReturnBlob) {
            const worker = html2pdf().set(opt).from(sourceSection);
            const blob = await worker.outputPdf("blob");
            triggerBlobDownload(blob, opt.filename);
            return blob;
        }

        await html2pdf().set(opt).from(sourceSection).save();
        return null;
    } catch (error) {
        console.error("PDF ?? ??:", error);
        alert("PDF ?? ? ??? ??????.");
        return null;
    } finally {
        if (typeof restoreChartDpr === "function") {
            restoreChartDpr();
        }
        sourceSection.classList.remove("pdf-section-export-mode");
        await waitForPaint();
        resizeCharts(targetCharts);
    }
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

function getScoreStatus(score) {
    return Number(score ?? 0) < 60 ? "훈련 필요" : "안정";
}

function formatTrendAxisDate(value) {
    const normalizedValue = normalizeText(value);
    const matchedDate = normalizedValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!matchedDate) {
        return normalizedValue;
    }

    return `${matchedDate[1].slice(2)}/${matchedDate[2]}/${matchedDate[3]}`;
}

function buildTrendSummaryMessage(point, filterLabel, fallbackScore) {
    const questionTypeScores = Array.isArray(point?.questionTypeScores) ? point.questionTypeScores : [];
    const noTrainingMessage = "훈련 결과, 해당 유형은 더 이상 훈련이 필요하지 않습니다.";

    if (isAllFilter(filterLabel)) {
        const trainingNeededTypes = questionTypeScores
            .filter((item) => item && item.trainingNeeded)
            .map((item) => normalizeText(item.questionTypeName))
            .filter(Boolean);

        if (!trainingNeededTypes.length) {
            return noTrainingMessage;
        }

        return `현재 ${trainingNeededTypes.join(", ")} 유형의 훈련이 필요합니다.`;
    }

    const targetName = normalizeQuestionTypeName(filterLabel);
    const matchedItem = questionTypeScores.find(
        (item) => normalizeQuestionTypeName(item.questionTypeName) === targetName
    );

    if (matchedItem) {
        return matchedItem.trainingNeeded
            ? `현재 ${normalizeText(matchedItem.questionTypeName)} 유형의 훈련이 필요합니다.`
            : noTrainingMessage;
    }

    return getScoreStatus(fallbackScore) === "훈련 필요"
        ? `현재 ${normalizeText(filterLabel)} 유형의 훈련이 필요합니다.`
        : noTrainingMessage;
}

function formatDaysLabel(days) {
    if (days === 7) {
        return "1주일";
    }
    if (days === 30) {
        return "1개월";
    }
    if (days === 90) {
        return "3개월";
    }
    return `${days}일`;
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
    const completeScores = buildCompleteQuestionTypeScores(scores);

    if (isAllFilter(filterLabel)) {
        return completeScores;
    }

    const targetName = normalizeQuestionTypeName(filterLabel);
    return completeScores.filter((item) => normalizeQuestionTypeName(item.questionTypeName) === targetName);
}
function filterQuestionScores(questionScores, filterLabel) {
    if (isAllFilter(filterLabel)) {
        return [];
    }

    const targetName = normalizeQuestionTypeName(filterLabel);

    return (questionScores || []).filter((item) =>
        normalizeQuestionTypeName(item.questionTypeName) === targetName
    );
}

function buildQuestionChartLabel(item, index) {
    return `${index + 1}번`;
}

function getQuestionScoreValue(item) {
    return Number(item.score ?? item.averageScore ?? 0);
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

function findLatestQuestionTypeScore(latestScores, filterLabel) {
    if (!Array.isArray(latestScores) || isAllFilter(filterLabel)) {
        return null;
    }

    const targetName = normalizeQuestionTypeName(filterLabel);
    const matchedItem = latestScores.find(
        (item) => normalizeQuestionTypeName(item.questionTypeName) === targetName
    );

    if (!matchedItem) {
        return null;
    }

    return Number(matchedItem.averageScore ?? 0);
}

function buildTrendSeries(points, filterLabel, latestScores = []) {
    const scores = points.map((point) => extractTrendScore(point, filterLabel));

    if (!isAllFilter(filterLabel) && points.length === 1) {
        const latestScore = findLatestQuestionTypeScore(latestScores, filterLabel);
        if (latestScore !== null) {
            scores[0] = latestScore;
        }
    }

    return {
        labels: points.map((point) => point.performedDate),
        scores
    };
}

function renderLatestChart(scores, filterLabel = "전체", questionScores = []) {
    const context = document.getElementById("latest-report-chart");
    if (!context) {
        return;
    }

    if (latestReportChart) {
        latestReportChart.destroy();
    }

    const isAll = isAllFilter(filterLabel);
    const chartItems = isAll
        ? filterQuestionTypeScores(scores, filterLabel)
        : filterQuestionScores(questionScores, filterLabel);

    latestReportChart = new Chart(context, {
        type: "bar",
        data: {
            labels: chartItems.map((item, index) =>
                isAll ? item.questionTypeName : buildQuestionChartLabel(item, index)
            ),
            datasets: [{
                label: isAll ? "문항 타입별 평균 점수" : "문항별 점수",
                data: chartItems.map((item) =>
                    isAll ? Number(item.averageScore ?? 0) : getQuestionScoreValue(item)
                ),
                backgroundColor: chartItems.map((item) =>
                    item.trainingNeeded ? "#F94144" : "#14AE5C"
                ),
                borderRadius: 12,
                maxBarThickness: isAll ? 38 : 48
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    top: 10,
                    right: 6,
                    bottom: 10,
                    left: 2
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        title(context) {
                            const index = context[0]?.dataIndex ?? 0;
                            const item = chartItems[index];

                            if (isAll) {
                                return item?.questionTypeName ?? "";
                            }

                            return item?.questionText || `${index + 1}번 문항`;
                        },
                        label(context) {
                            const score = Number(context.raw ?? 0);
                            return score < 60
                                ? `점수 ${formatScore(score)}점 / 훈련 필요`
                                : `점수 ${formatScore(score)}점 / 안정`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        maxRotation: isAll ? 45 : 0,
                        minRotation: isAll ? 45 : 0,
                        autoSkip: false
                    }
                },
                y: {
                    min: 0,
                    max: 100,
                    grace: 0,
                    ticks: {
                        stepSize: 20
                    }
                }
            }
        }
    });
}

function renderTrendChart(points, filterLabel = "??", latestScores = []) {
    const context = document.getElementById("trend-report-chart");
    if (!context) {
        return;
    }

    if (trendReportChart) {
        trendReportChart.destroy();
    }

    const series = buildTrendSeries(points, filterLabel, latestScores);

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
                pointHitRadius: 10,
                clip: false,
                fill: true,
                tension: 0.3,
                spanGaps: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    top: 10,
                    right: 6,
                    bottom: 10,
                    left: 2
                }
            },
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
                x: {
                    ticks: {
                        callback(value, index) {
                            const label = this.getLabelForValue(value) ?? series.labels[index] ?? "";
                            return formatTrendAxisDate(label);
                        },
                        maxRotation: 0,
                        minRotation: 0,
                        autoSkip: false
                    }
                },
                y: {
                    min: 0,
                    max: 100,
                    grace: 0,
                    ticks: {
                        stepSize: 20
                    }
                }
            }
        }
    });
}

function renderTypeSummary(scores, filterLabel = "전체", questionScores = []) {
    const container = document.getElementById("report-type-summary");
    if (!container) {
        return;
    }

    const isAll = isAllFilter(filterLabel);

    if (isAll) {
        const filteredScores = filterQuestionTypeScores(scores, filterLabel);
        container.innerHTML = filteredScores.map((item) => `
            <div class="report-type-summary-item">
                <span class="report-type-name">${escapeHtml(item.questionTypeName)}</span>
                <div class="report-type-meta">
                    <span class="report-type-score">${item.isMissingScore ? "0점" : `${formatScore(item.averageScore)}점`}</span>
                    <span class="report-type-badge ${item.trainingNeeded ? "is-training-needed" : "is-stable"}">
                        ${item.isMissingScore ? "데이터 없음" : (item.trainingNeeded ? "훈련 필요" : "안정")}
                    </span>
                </div>
            </div>
        `).join("");

        container.classList.toggle("hidden", filteredScores.length === 0);
        return;
    }

    const filteredQuestions = filterQuestionScores(questionScores, filterLabel);

    container.innerHTML = filteredQuestions.map((item, index) => {
        const score = getQuestionScoreValue(item);

        return `
            <div class="report-question-summary-item">
                <div class="report-question-top">
                    <div class="report-question-main">
                        <span class="report-question-index">${index + 1}번 문항</span>
                        <span class="report-question-text">${escapeHtml(item.questionText || "문항 내용 없음")}</span>
                    </div>
                    <div class="report-type-meta">
                        <span class="report-type-score">${formatScore(score)}점</span>
                        <span class="report-type-badge ${item.trainingNeeded ? "is-training-needed" : "is-stable"}">
                            ${item.trainingNeeded ? "훈련 필요" : "안정"}
                        </span>
                    </div>
                </div>
                <div class="report-answer-box">
                    <span class="report-answer-label">답변</span>
                    <span class="report-answer-text">${escapeHtml(item.answerText || "답변 내용 없음")}</span>
                </div>
            </div>
        `;
    }).join("");

    container.classList.toggle("hidden", filteredQuestions.length === 0);
}

function renderTrendPointSummary(points, filterLabel = "전체", latestScores = []) {
    const container = document.getElementById("trend-point-summary");
    if (!container) {
        return;
    }

    const series = buildTrendSeries(points, filterLabel, latestScores);
    const summaryItems = series.labels
        .map((performedDate, index) => {
            const score = series.scores[index];
            if (score === null || score === undefined) {
                return "";
            }

            const status = getScoreStatus(score);
            const point = points[index];
            const summaryMessage = buildTrendSummaryMessage(point, filterLabel, score);
            return `
                <div class="report-type-summary-item trend-point-summary-item">
                    <div class="trend-point-summary-top">
                        <div class="trend-point-summary-main">
                            <span class="report-type-name">${escapeHtml(performedDate)}</span>
                            <span class="report-type-score">평균 ${formatScore(score)}점</span>
                        </div>
                        <div class="report-type-meta">
                            <span class="report-type-badge ${status === "훈련 필요" ? "is-training-needed" : "is-stable"}">${status}</span>
                        </div>
                    </div>
                    <span class="trend-point-summary-message">${escapeHtml(summaryMessage)}</span>
                </div>
            `;
        })
        .filter(Boolean)
        .join("");

    container.innerHTML = summaryItems;
    container.classList.toggle("hidden", !summaryItems);
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
    const trendPointSummary = document.getElementById("trend-point-summary");
    const latestReportFilterButtons = Array.from(document.querySelectorAll('[data-report-filter-scope="latest"]'));
    const trendReportFilterButtons = Array.from(document.querySelectorAll('[data-report-filter-scope="trend"]'));
    const downloadButtons = [
        document.getElementById("report-download-btn"),
        document.getElementById("trend-download-btn")
    ].filter(Boolean);

    if (!searchInput || !searchToggleButton || !comboBox || !searchWrap || !historySelect || !trendSelect || !trendSummaryHeader || !reportTypeSummary || !trendPointSummary) {
        return;
    }

    let recipients = [];
    let isLocked = false;
    let selectedRecipient = null;
    let latestQuestionTypeScores = [];
    let latestQuestionScores = [];
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
        const isAll = isAllFilter(selectedFilter);

        const filteredItems = isAll
            ? filterQuestionTypeScores(latestQuestionTypeScores, selectedFilter)
            : filterQuestionScores(latestQuestionScores, selectedFilter);

        if (!filteredItems.length) {
            reportTypeSummary.innerHTML = "";
            reportTypeSummary.classList.add("hidden");
            latestReportEmpty.textContent = isAll
                ? "검사 분석 결과가 아직 없습니다."
                : "선택한 문항 타입의 문항별 점수가 없습니다.";
            setEmptyState(latestReportEmpty, true);
            if (latestReportChart) {
                latestReportChart.destroy();
                latestReportChart = null;
            }
            return;
        }

        latestReportEmpty.textContent = "검사 분석 결과가 아직 없습니다.";
        setEmptyState(latestReportEmpty, false);
        renderLatestChart(latestQuestionTypeScores, selectedFilter, latestQuestionScores);
        renderTypeSummary(latestQuestionTypeScores, selectedFilter, latestQuestionScores);
    };

    const applyTrendReportFilter = () => {
        if (!trendReportPoints.length) {
            setEmptyState(trendReportEmpty, true);
            trendPointSummary.innerHTML = "";
            trendPointSummary.classList.add("hidden");
            if (trendReportChart) {
                trendReportChart.destroy();
                trendReportChart = null;
            }
            return;
        }

        const selectedFilter = getSelectedReportFilter(trendReportFilterButtons);
        const series = buildTrendSeries(trendReportPoints, selectedFilter, latestQuestionTypeScores);
        const hasRenderableScore = series.scores.some((score) => score !== null && score !== undefined);

        if (!hasRenderableScore) {
            trendReportEmpty.textContent = "선택한 문항 타입의 기간별 점수가 없습니다.";
            setEmptyState(trendReportEmpty, true);
            trendPointSummary.innerHTML = "";
            trendPointSummary.classList.add("hidden");
            if (trendReportChart) {
                trendReportChart.destroy();
                trendReportChart = null;
            }
            return;
        }

        setEmptyState(trendReportEmpty, false);
        renderTrendChart(trendReportPoints, selectedFilter, latestQuestionTypeScores);
        renderTrendPointSummary(trendReportPoints, selectedFilter, latestQuestionTypeScores);
    };

    const resetReportUi = (message) => {
        destroyCharts();
        historySelect.innerHTML = '<option value="">리포트 선택</option>';
        reportSummaryHeader.textContent = message;
        trendSummaryHeader.textContent = "최근 기간의 검사일별 평균 점수 변화를 표시합니다.";
        reportTypeSummary.innerHTML = "";
        reportTypeSummary.classList.add("hidden");
        trendPointSummary.innerHTML = "";
        trendPointSummary.classList.add("hidden");
        latestQuestionTypeScores = [];
        latestQuestionScores = [];
        trendReportPoints = [];
        latestReportEmpty.textContent = "검사 분석 결과가 아직 없습니다.";
        trendReportEmpty.textContent = "기간별 그래프로 표시할 검사 결과가 없습니다.";
        setActiveReportFilter(latestReportFilterButtons, getAllReportFilterButton(latestReportFilterButtons));
        setActiveReportFilter(trendReportFilterButtons, getAllReportFilterButton(trendReportFilterButtons));
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

        const normalizedKeyword = keyword.toLowerCase();
        const matchedRecipients = recipients.filter((recipient) =>
            String(recipient.recipientName ?? "").trim().toLowerCase().includes(normalizedKeyword)
        );

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

        const normalizedTypedName = typedName.toLowerCase();

        if (
            selectedRecipient &&
            String(selectedRecipient.recipientName ?? "").trim().toLowerCase() === normalizedTypedName
        ) {
            return selectedRecipient;
        }

        return recipients.find((recipient) =>
            String(recipient.recipientName ?? "").trim().toLowerCase() === normalizedTypedName
        ) ?? null;
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
            renderCombo();
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
    button.addEventListener("click", async () => {
        const sectionType = button.dataset.reportSection || "latest";
        const sectionId = sectionType === "trend" ? "trend-report-section" : "latest-report-section";
        const pdfFileName = buildPdfFileName(
            selectedRecipient?.recipientName || searchInput.value || "수급자",
            sectionType
        );

        const pdfBlob = await downloadPDF(sectionId, true, pdfFileName);

        if (selectedRecipient && historySelect.value && pdfBlob) {
            try {
                const formData = new FormData();
                formData.append("recipientId", String(selectedRecipient.recipientId));
                formData.append("performanceId", String(Number(historySelect.value)));
                formData.append("pdfFile", pdfBlob, pdfFileName);

                const response = await fetch("/api/reports/pdf-files", {
                    method: "POST",
                    body: formData
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error("report_pdf_upload_failed", response.status, errorText);
                    throw new Error("report_pdf_upload_failed");
                }

                const payload = await response.json();
                console.info("report_pdf_upload_succeeded", payload.pdfFilePath);
            } catch (error) {
                console.error("report_pdf_upload_error", error);
                alert("PDF는 다운로드되었지만 서버 저장에는 실패했습니다.");
            }
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

            reports.forEach((report) => {
                const option = document.createElement("option");
                option.value = String(report.performanceId);
                option.textContent = buildReportHistoryLabel(report.performedAt, report.reportType);
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
                trendPointSummary.innerHTML = "";
                trendPointSummary.classList.add("hidden");
                setEmptyState(latestReportEmpty, true);
                setEmptyState(trendReportEmpty, true);
                destroyCharts();
                return;
            }

            historySelect.value = String(reports[0].performanceId);
            await loadLatestReport(recipientId, reports[0].performanceId);
            await loadTrendReport(recipientId, Number(trendSelect.value));
        } catch (error) {
            console.error("loadReportsForRecipient 실패:", error);
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
                ? `${payload.recipientName} 님의 ${buildReportHistoryLabel(payload.performedAt, payload.reportType)} 결과입니다.`
                : `${payload.recipientName} 님의 ${(payload.reportType || "검사")} 결과입니다.`;

            if (!payload.questionTypeScores?.length) {
                latestQuestionTypeScores = [];
                latestQuestionScores = [];
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

            latestQuestionTypeScores = payload.questionTypeScores || [];
            latestQuestionScores = payload.questionScores || [];
            applyLatestReportFilter();
        } catch (error) {
            console.error(error);
            latestQuestionTypeScores = [];
            latestQuestionScores = [];
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
                trendPointSummary.innerHTML = "";
                trendPointSummary.classList.add("hidden");
                setActiveReportFilter(trendReportFilterButtons, getAllReportFilterButton(trendReportFilterButtons));
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
            trendPointSummary.innerHTML = "";
            trendPointSummary.classList.add("hidden");
            setActiveReportFilter(trendReportFilterButtons, getAllReportFilterButton(trendReportFilterButtons));
            trendSummaryHeader.textContent = "기간별 변화 추이를 불러오지 못했습니다.";
            setEmptyState(trendReportEmpty, true);
        }
    }
});


