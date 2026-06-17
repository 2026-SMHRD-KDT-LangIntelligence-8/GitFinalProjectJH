const AUTH_STORAGE_KEY = "isLoggedIn";
const KAKAO_LOGOUT_URL = "/logout";
const TEST_PROGRESS_STORAGE_KEY = "latestCognitiveTestProgress";

document.addEventListener("DOMContentLoaded", async () => {
    const loginLink = document.getElementById("loginLink");
    const logoutLink = document.getElementById("logoutLink");
    const authDivider = document.getElementById("authDivider");
    const protectedMenuLinks = Array.from(document.querySelectorAll(".menu-item"));

    let isAuthenticated = false;

    function syncLoginStateFromUrl() {
        const params = new URLSearchParams(window.location.search);
        if (params.get("login") === "success") {
            localStorage.setItem(AUTH_STORAGE_KEY, "true");
            window.history.replaceState({}, document.title, "/main");
        }
    }

    function updateAuthUi(isLoggedIn) {
        isAuthenticated = isLoggedIn;
        loginLink.classList.toggle("hidden", isLoggedIn);
        logoutLink.classList.toggle("hidden", !isLoggedIn);
        authDivider.classList.add("hidden");
    }

    async function refreshAuthState() {
        try {
            const response = await fetch("/api/users/status", {
                cache: "no-store"
            });

            if (response.ok) {
                const payload = await response.json();
                if (payload.authenticated) {
                    if (payload.caregiverProfileCompleted === false) {
                        window.location.href = "/caregiver-info";
                        return;
                    }

                    localStorage.setItem(AUTH_STORAGE_KEY, "true");
                    updateAuthUi(true);
                    return;
                }
            }
        } catch (error) {
            console.error(error);
        }

        localStorage.removeItem(AUTH_STORAGE_KEY);
        updateAuthUi(false);
    }

    logoutLink.addEventListener("click", (event) => {
        event.preventDefault();
        localStorage.removeItem(AUTH_STORAGE_KEY);
        sessionStorage.removeItem(TEST_PROGRESS_STORAGE_KEY);
        window.location.href = KAKAO_LOGOUT_URL;
    });

    protectedMenuLinks.forEach((link) => {
        link.addEventListener("click", (event) => {
            if (isAuthenticated) {
                return;
            }

            event.preventDefault();
            alert("로그인이 필요합니다.");
            window.location.href = "/login";
        });
    });

    syncLoginStateFromUrl();
    updateAuthUi(false);
    await refreshAuthState();
});
