// 수급자 상세 화면에서 생년월일 입력값을 YYYY-MM-DD 형식으로 보정한다.
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
