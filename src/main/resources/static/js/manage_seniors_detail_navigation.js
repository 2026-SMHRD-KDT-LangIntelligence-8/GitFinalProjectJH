// 수급자 상세 화면의 수정 버튼을 수정 페이지로 연결하는 스크립트.
// 상세 화면 자체는 조회 역할만 하고, 실제 편집은 별도 화면에서 처리하도록 역할을 분리한다.
document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    const recipientId = params.get("recipientId");
    const editButton = document.getElementById("detail-edit-button");

    if (!recipientId || !editButton) {
        return;
    }

    editButton.addEventListener("click", () => {
        window.location.href = `/manage-seniors/edit?recipientId=${recipientId}`;
    });
});
