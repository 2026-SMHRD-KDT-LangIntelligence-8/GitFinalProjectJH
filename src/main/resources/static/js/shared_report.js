let sharedReportChart = null;

document.addEventListener("DOMContentLoaded", async () => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const titleElement = document.getElementById("shared-report-title");
    const summaryElement = document.getElementById("shared-report-summary");
    const dateElement = document.getElementById("shared-report-date");
    const emptyElement = document.getElementById("shared-report-empty");
    const downloadButton = document.getElementById("shared-report-download-btn");

    downloadButton?.addEventListener("click", () => {
        const element = document.getElementById("shared-report-area");
        html2pdf().set({
            margin: 10,
            filename: "공유_리포트.pdf",
            image: {type: "jpeg", quality: 0.98},
            html2canvas: {scale: 2, useCORS: true},
            jsPDF: {unit: "mm", format: "a4", orientation: "portrait"}
        }).from(element).save();
    });

    if (!token) {
        summaryElement.textContent = "유효한 공유 링크가 아닙니다.";
        emptyElement.classList.add("is-visible");
        return;
    }

    try {
        const response = await fetch(`/api/reports/shared?token=${encodeURIComponent(token)}`);
        if (!response.ok) {
            throw new Error("shared_report_fetch_failed");
        }

        const payload = await response.json();
        titleElement.textContent = `${payload.recipientName} 님 리포트`;
        summaryElement.textContent = payload.performedAt
            ? `${payload.performedAt} 검사 결과입니다.`
            : "공유된 검사 결과입니다.";
        dateElement.textContent = payload.performedAt || "공유 링크";

        if (!payload.questionTypeScores?.length) {
            emptyElement.classList.add("is-visible");
            return;
        }

        emptyElement.classList.remove("is-visible");
        renderSharedChart(payload.questionTypeScores);
    } catch (error) {
        console.error(error);
        summaryElement.textContent = "공유 리포트를 불러오지 못했습니다.";
        emptyElement.classList.add("is-visible");
    }
});

function renderSharedChart(scores) {
    const context = document.getElementById("shared-report-chart");
    if (!context) {
        return;
    }

    if (sharedReportChart) {
        sharedReportChart.destroy();
    }

    sharedReportChart = new Chart(context, {
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
