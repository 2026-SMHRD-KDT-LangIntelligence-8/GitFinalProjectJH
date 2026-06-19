const MAX_PREVIOUS_REPORTS = 5;
let detailTrendChart = null;

document.addEventListener("DOMContentLoaded", async () => {
    const params = new URLSearchParams(window.location.search);
    const recipientId = params.get("recipientId");

    if (!recipientId) {
        return;
    }

    const trendSelect = document.getElementById("detail-trend-select");

    try {
        const response = await fetch(`/api/recipients/${recipientId}/detail`);
        if (!response.ok) {
            throw new Error("recipient_detail_failed");
        }

        const recipient = await response.json();
        fillRecipientBaseInfo(recipient);
        renderTrainingStatuses(recipient.trainingStatuses ?? [], recipient);

        await loadPreviousReports(recipientId, recipient);
        await loadTrendReport(recipientId, Number(trendSelect?.value || 7), recipient);

        trendSelect?.addEventListener("change", async () => {
            await loadTrendReport(recipientId, Number(trendSelect.value || 7), recipient);
        });
    } catch (error) {
        console.error(error);
    }
});

function fillRecipientBaseInfo(recipient) {
    document.getElementById("val-name").textContent = recipient.recipientName ?? "";
    document.getElementById("val-keypad").value = recipient.birthDate ?? "";
    document.getElementById("val-guardian-name").textContent = recipient.guardianName ?? "";
    document.getElementById("val-phone").textContent = formatPhoneNumber(recipient.emergencyContact);
    document.getElementById("val-date").textContent = recipient.latestTestDate ?? "-";
    document.getElementById("notes-textarea").value = recipient.notes ?? "";

    const genderSelect = document.getElementById("toggle-gender");
    const gradeSelect = document.getElementById("toggle-grade");
    const gender = String(recipient.gender ?? "").toLowerCase();

    if (["남", "남성", "male"].includes(gender) || recipient.gender === "남" || recipient.gender === "남성") {
        genderSelect.value = "male";
    } else if (["여", "여성", "female"].includes(gender) || recipient.gender === "여" || recipient.gender === "여성") {
        genderSelect.value = "female";
    }

    if (recipient.careGrade) {
        gradeSelect.value = String(recipient.careGrade).replace("등급", "");
    }
}

function renderTrainingStatuses(trainingStatuses, recipient) {
    const container = document.getElementById("training-status-list");
    const hasExamHistory = Number(recipient?.testCount ?? 0) > 0 || Boolean(recipient?.latestTestDate);

    if (!container) {
        return;
    }

    if (trainingStatuses.length === 0) {
        container.innerHTML = `
            <div class="recipient-empty-message training-status-empty">
                ${hasExamHistory
                    ? [
                        "1단계 검사 기록 확인은 완료되었습니다.",
                        "2단계 문항 분석과 점수 계산을 진행 중입니다.",
                        "3단계 훈련 현황 조회는 분석 완료 후 자동으로 갱신됩니다.",
                        "예상 대기 시간은 약 1~3분입니다."
                    ].join("<br>")
                    : "검사 이력이 없어 아직 훈련 현황을 계산할 수 없습니다."}
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="training-status-scroll" aria-label="훈련 현황 목록">
            ${trainingStatuses.map((status) => `
                <div class="recipient-row">
                    <span class="recipient-cell w-name" title="${escapeHtml(status.questionTypeName)}">${escapeHtml(status.questionTypeName)}</span>
                    <span class="recipient-cell w-grade">
                        <span class="training-status-badge ${status.trainingNeeded ? "is-training-needed" : "is-stable"}" title="${escapeHtml(status.statusLabel)}">
                            ${escapeHtml(status.statusLabel)}
                        </span>
                    </span>
                    <span class="recipient-cell w-birth">평균 ${formatScore(status.averageAppropriatenessScore)}점</span>
                </div>
            `).join("")}
        </div>
    `;
}

function renderTrainingStatusError(message) {
    const container = document.getElementById("training-status-list");
    if (!container) {
        return;
    }

    container.innerHTML = `
        <div class="recipient-empty-message training-status-empty">
            ${escapeHtml(message)}
        </div>
    `;
}

function mapQuestionTypeScoresToTrainingStatuses(scores) {
    return (Array.isArray(scores) ? scores : []).map((score) => ({
        questionTypeId: score.questionTypeId,
        questionTypeName: score.questionTypeName,
        averageAppropriatenessScore: Math.round(Number(score.averageScore ?? 0)),
        analyzedQuestionCount: 0,
        statusLabel: score.trainingNeeded ? "훈련 필요" : "안정",
        trainingNeeded: Boolean(score.trainingNeeded)
    }));
}

function setActivePreviousReportItem(container, performanceId) {
    container.querySelectorAll(".recipient-history-item").forEach((item) => {
        const isActive = String(item.dataset.performanceId) === String(performanceId);
        item.classList.toggle("is-active", isActive);
        item.setAttribute("aria-pressed", String(isActive));
    });
}

async function loadPreviousReports(recipientId, recipient) {
    const container = document.getElementById("previous-report-list");
    const hasExamHistory = Number(recipient?.testCount ?? 0) > 0 || Boolean(recipient?.latestTestDate);

    if (!container) {
        return;
    }

    try {
        const response = await fetch(`/api/reports/recipients/${recipientId}/performances`);
        if (!response.ok) {
            throw new Error("report_list_failed");
        }

        const reports = await response.json();

        if (!reports.length) {
            container.innerHTML = `
                <div class="recipient-empty-message">
                    ${hasExamHistory
                        ? "검사 기록은 확인되었지만 이전 리포트가 아직 생성 중입니다.<br>예상 대기 시간은 약 1~3분입니다."
                        : "아직 생성된 리포트가 없습니다."}
                </div>
            `;
            return;
        }

        const recentReports = reports.slice(0, MAX_PREVIOUS_REPORTS);
        const reportDetails = await Promise.all(
            recentReports.map(async (report) => {
                try {
                    const detailResponse = await fetch(`/api/reports/recipients/${recipientId}/performances/${report.performanceId}`);
                    if (!detailResponse.ok) {
                        throw new Error("report_detail_failed");
                    }

                    const detail = await detailResponse.json();
                    const scores = Array.isArray(detail.questionTypeScores) ? detail.questionTypeScores : [];
                    const averageScore = scores.length
                        ? scores.reduce((sum, item) => sum + Number(item.averageScore ?? 0), 0) / scores.length
                        : null;
                    const weakCount = scores.filter((item) => item.trainingNeeded).length;

                    return {
                        performanceId: report.performanceId,
                        performedAt: report.performedAt,
                        averageScore,
                        weakCount,
                        trainingStatuses: mapQuestionTypeScoresToTrainingStatuses(scores)
                    };
                } catch (error) {
                    console.error(error);
                    return {
                        performanceId: report.performanceId,
                        performedAt: report.performedAt,
                        averageScore: null,
                        weakCount: null,
                        trainingStatuses: []
                    };
                }
            })
        );

        container.innerHTML = `
            <div class="recipient-history-scroll" aria-label="이전 리포트 목록">
                ${reportDetails.map((report, index) => `
                    <div class="recipient-history-item ${index === 0 ? "is-active" : ""} ${report.weakCount > 0 ? "has-training-needed" : ""}" data-performance-id="${report.performanceId}" role="button" tabindex="0" aria-pressed="${index === 0 ? "true" : "false"}">
                        <div class="recipient-history-main">
                            <div class="recipient-history-date">${escapeHtml(report.performedAt)}</div>
                            <div class="recipient-history-meta ${report.weakCount > 0 ? "is-training-needed" : ""}">
                                ${buildHistoryMeta(report)}
                            </div>
                        </div>
                        <div class="recipient-history-score">
                            ${report.averageScore == null ? "-" : `${formatScore(report.averageScore)}점`}
                        </div>
                    </div>
                `).join("")}
            </div>
        `;

        const reportDetailMap = new Map(reportDetails.map((report) => [String(report.performanceId), report]));
        const historyItems = Array.from(container.querySelectorAll(".recipient-history-item"));

        const applySelectedReport = (performanceId) => {
            const selectedReport = reportDetailMap.get(String(performanceId));
            if (!selectedReport) {
                return;
            }

            setActivePreviousReportItem(container, performanceId);

            if (selectedReport.trainingStatuses.length) {
                renderTrainingStatuses(selectedReport.trainingStatuses, recipient);
                return;
            }

            renderTrainingStatusError("선택한 리포트의 훈련 현황을 불러오지 못했습니다.");
        };

        historyItems.forEach((item) => {
            item.addEventListener("click", () => {
                applySelectedReport(item.dataset.performanceId);
            });

            item.addEventListener("keydown", (event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    applySelectedReport(item.dataset.performanceId);
                }
            });
        });

        if (reportDetails[0]) {
            applySelectedReport(reportDetails[0].performanceId);
        }
    } catch (error) {
        console.error(error);
        container.innerHTML = `
            <div class="recipient-empty-message">
                이전 리포트 목록을 불러오지 못했습니다.
            </div>
        `;
    }
}

async function loadTrendReport(recipientId, days, recipient) {
    const summary = document.getElementById("detail-trend-summary");
    const empty = document.getElementById("detail-trend-empty");
    const hasExamHistory = Number(recipient?.testCount ?? 0) > 0 || Boolean(recipient?.latestTestDate);

    try {
        const response = await fetch(`/api/reports/recipients/${recipientId}/trend?days=${days}`);
        if (!response.ok) {
            throw new Error("trend_report_failed");
        }

        const payload = await response.json();

        if (!payload.points?.length) {
            destroyDetailTrendChart();
            summary.textContent = hasExamHistory
                ? `최근 ${formatDaysLabel(days)} 동안의 평균 점수 추이가 아직 생성 중입니다.`
                : `최근 ${formatDaysLabel(days)} 동안 표시할 검사 결과가 없습니다.`;
            empty.textContent = hasExamHistory
                ? "리포트 생성 후 기간별 평균 점수 변화가 자동으로 표시됩니다."
                : "기간별 추이를 그릴 검사 결과가 없습니다.";
            empty.classList.add("is-visible");
            return;
        }

        summary.textContent = `최근 ${formatDaysLabel(days)} 동안 검사일별 평균 점수 추이입니다.`;
        empty.classList.remove("is-visible");
        renderDetailTrendChart(payload.points);
    } catch (error) {
        console.error(error);
        destroyDetailTrendChart();
        summary.textContent = "기간별 변화 데이터를 불러오지 못했습니다.";
        empty.textContent = "잠시 후 다시 시도해 주세요.";
        empty.classList.add("is-visible");
    }
}

function renderDetailTrendChart(points) {
    const context = document.getElementById("detail-trend-chart");
    if (!context || typeof Chart === "undefined") {
        return;
    }

    destroyDetailTrendChart();

    detailTrendChart = new Chart(context, {
        type: "line",
        data: {
            labels: points.map((point) => point.performedDate),
            datasets: [{
                label: "검사일별 평균 점수",
                data: points.map((point) => point.averageScore),
                borderColor: "#277DA1",
                backgroundColor: "rgba(39, 125, 161, 0.18)",
                borderWidth: 3,
                fill: true,
                tension: 0.28,
                pointRadius: 4,
                pointHoverRadius: 5,
                pointBackgroundColor: "#E74C3C"
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
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        stepSize: 20
                    },
                    grid: {
                        color: "rgba(17, 56, 28, 0.12)"
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

function destroyDetailTrendChart() {
    if (detailTrendChart) {
        detailTrendChart.destroy();
        detailTrendChart = null;
    }
}

function buildHistoryMeta(report) {
    if (report.averageScore == null) {
        return "점수 요약을 아직 불러오지 못했습니다.";
    }

    if (report.weakCount == null) {
        return "영역별 훈련 상태를 계산 중입니다.";
    }

    return `영역 평균 ${formatScore(report.averageScore)}점 · 훈련 필요 ${report.weakCount}개`;
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

function formatScore(value) {
    const numeric = Number(value ?? 0);
    return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1);
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\"", "&quot;")
        .replaceAll("'", "&#39;");
}

function formatPhoneNumber(value) {
    const numbersOnly = String(value ?? "").replace(/[^0-9]/g, "");

    if (numbersOnly.length === 11) {
        return `${numbersOnly.slice(0, 3)}-${numbersOnly.slice(3, 7)}-${numbersOnly.slice(7)}`;
    }

    if (numbersOnly.length === 10) {
        return `${numbersOnly.slice(0, 3)}-${numbersOnly.slice(3, 6)}-${numbersOnly.slice(6)}`;
    }

    return value ?? "";
}
