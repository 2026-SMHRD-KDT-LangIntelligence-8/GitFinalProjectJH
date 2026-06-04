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
