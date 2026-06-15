// 로그인 화면에서 카카오 OAuth 인증 시작 경로로 이동한다.
// 버튼의 onclick 에서 이 함수를 호출해 로그인 흐름을 시작한다.
const KAKAO_LOGIN_URL = "/oauth2/authorization/kakao";

function loginWithKakao() {
    window.location.href = KAKAO_LOGIN_URL;
}
