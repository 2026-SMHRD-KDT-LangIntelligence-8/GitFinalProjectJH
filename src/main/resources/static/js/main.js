// 메인 화면의 로그인 상태와 로그아웃 동작을 관리한다.
// 로그인 성공 후에는 쿼리 파라미터를 정리하고, 버튼 표시 상태를 갱신한다.
const AUTH_STORAGE_KEY = "isLoggedIn";
const KAKAO_LOGOUT_URL = "/logout";
const loginLink = document.getElementById("loginLink");
const logoutLink = document.getElementById("logoutLink");
const authDivider = document.getElementById("authDivider");

function syncLoginStateFromUrl() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("login") === "success") {
        localStorage.setItem(AUTH_STORAGE_KEY, "true");
        window.history.replaceState({}, document.title, "/main");
    }
}

function updateAuthUi() {
    const isLoggedIn = localStorage.getItem(AUTH_STORAGE_KEY) === "true";
    loginLink.classList.toggle("hidden", isLoggedIn);
    logoutLink.classList.toggle("hidden", !isLoggedIn);
    authDivider.classList.add("hidden");
}

logoutLink.addEventListener("click", (event) => {
    event.preventDefault();
    localStorage.removeItem(AUTH_STORAGE_KEY);
    window.location.href = KAKAO_LOGOUT_URL;
});

syncLoginStateFromUrl();
updateAuthUi();
