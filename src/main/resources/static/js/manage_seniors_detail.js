// 수급자 상세 화면의 생년월일 입력값을 YYYY-MM-DD 형식으로 보정한다.
// 숫자만 입력된 상태로 포커스를 벗어나면 날짜 문자열 형태로 자동 변환한다.
document.getElementById("val-keypad").addEventListener("blur", (event) => {
    let value = event.target.value.replace(/[^0-9]/g, "");
    let y = "";
    let m = "";
    let d = "";

    if (value.length === 0) {
        event.target.value = "";
        return;
    }

    if (value.length === 8) {
        y = value.substring(0, 4);
        m = value.substring(4, 6);
        d = value.substring(6, 8);
    } else if (value.length === 7) {
        y = value.substring(0, 4);
        const rest = value.substring(4);

        if (rest.startsWith("0")) {
            m = rest.substring(0, 2);
            d = "0" + rest.substring(2, 3);
        } else {
            m = "0" + rest.substring(0, 1);
            d = rest.substring(1, 3);
        }
    } else if (value.length === 6) {
        const prefix = parseInt(value.substring(0, 2), 10) > 30 ? "19" : "20";
        y = prefix + value.substring(0, 2);
        m = value.substring(2, 4);
        d = value.substring(4, 6);
    } else if (value.length === 5) {
        const prefix = parseInt(value.substring(0, 2), 10) > 30 ? "19" : "20";
        y = prefix + value.substring(0, 2);
        const rest = value.substring(2);

        if (rest.startsWith("0")) {
            m = rest.substring(0, 2);
            d = "0" + rest.substring(2, 3);
        } else {
            m = "0" + rest.substring(0, 1);
            d = rest.substring(1, 3);
        }
    } else if (value.length === 4) {
        const prefix = parseInt(value.substring(0, 2), 10) > 30 ? "19" : "20";
        y = prefix + value.substring(0, 2);
        m = "0" + value.substring(2, 3);
        d = "0" + value.substring(3, 4);
    } else if (value.length === 3) {
        y = String(new Date().getFullYear());
        if (value.startsWith("0")) {
            m = value.substring(0, 2);
            d = "0" + value.substring(2, 3);
        } else {
            m = "0" + value.substring(0, 1);
            d = value.substring(1, 3);
        }
    } else if (value.length === 2) {
        y = String(new Date().getFullYear());
        m = "0" + value.substring(0, 1);
        d = "0" + value.substring(1, 2);
    } else {
        return;
    }

    event.target.value = `${y}-${m}-${d}`;
});

const notesEditButton = document.getElementById("notes-edit-button");
const notesDeleteButton = document.getElementById("notes-delete-button");
const notesTextarea = document.getElementById("notes-textarea");
const deleteModal = document.getElementById("recipient-delete-modal");
const deleteConfirmButton = document.getElementById("recipient-delete-confirm-button");
const deleteCancelButton = document.getElementById("recipient-delete-cancel-button");
const detailParams = new URLSearchParams(window.location.search);
const detailRecipientId = detailParams.get("recipientId");

if (notesEditButton && notesTextarea && detailRecipientId) {
    // 기타 특이사항 메모는 상세 화면에서 바로 수정 후 DB에 저장할 수 있게 한다.
    notesEditButton.addEventListener("click", async () => {
        if (notesTextarea.readOnly) {
            notesTextarea.readOnly = false;
            notesTextarea.removeAttribute("tabindex");
            notesEditButton.textContent = "저장";
            notesTextarea.focus();
            return;
        }

        notesEditButton.disabled = true;

        try {
            const response = await fetch(`/api/recipients/${detailRecipientId}/notes`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    notes: notesTextarea.value
                })
            });

            if (!response.ok) {
                throw new Error("수급자 메모 저장 실패");
            }

            const updatedRecipient = await response.json();
            notesTextarea.value = updatedRecipient.notes ?? "";
            notesTextarea.readOnly = true;
            notesTextarea.setAttribute("tabindex", "-1");
            notesTextarea.blur();
            notesEditButton.textContent = "수정";
            alert("기타 특이사항이 저장되었습니다.");
        } catch (error) {
            console.error(error);
            alert("기타 특이사항 저장에 실패했습니다.");
        } finally {
            notesEditButton.disabled = false;
        }
    });
}

const openDeleteModal = () => {
    if (!deleteModal) {
        return;
    }

    deleteModal.classList.remove("hidden");
    deleteConfirmButton?.focus();
};

const closeDeleteModal = () => {
    if (!deleteModal) {
        return;
    }

    deleteModal.classList.add("hidden");
    notesDeleteButton?.focus();
};

if (notesDeleteButton && deleteModal && deleteConfirmButton && deleteCancelButton && detailRecipientId) {
    notesDeleteButton.addEventListener("click", openDeleteModal);
    deleteCancelButton.addEventListener("click", closeDeleteModal);

    deleteConfirmButton.addEventListener("click", async () => {
        notesDeleteButton.disabled = true;
        deleteConfirmButton.disabled = true;
        deleteCancelButton.disabled = true;
        if (notesEditButton) {
            notesEditButton.disabled = true;
        }

        try {
            const response = await fetch(`/api/recipients/${detailRecipientId}`, {
                method: "DELETE"
            });

            if (!response.ok) {
                throw new Error("수급자 삭제 실패");
            }

            alert("수급자가 삭제되었습니다.");
            window.location.href = "/manage-seniors";
        } catch (error) {
            console.error(error);
            alert("수급자 삭제에 실패했습니다.");
            notesDeleteButton.disabled = false;
            deleteConfirmButton.disabled = false;
            deleteCancelButton.disabled = false;
            if (notesEditButton) {
                notesEditButton.disabled = false;
            }
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !deleteModal.classList.contains("hidden")) {
            closeDeleteModal();
        }
    });
}
