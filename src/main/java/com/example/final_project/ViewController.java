package com.example.final_project;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class ViewController {

    // 화면 렌더링을 templates 기반으로 통일하고,
    // 기존 .html 주소도 함께 매핑해 기존 접근 경로가 깨지지 않게 둔다.
    @GetMapping({"/", "/login", "/login.html"})
    public String loginPage() {
        return "login";
    }

    // 로그인 성공 후 진입하는 메인 화면 템플릿을 반환한다.
    @GetMapping({"/main", "/main.html"})
    public String mainPage() {
        return "main";
    }

    // 첫 로그인 사용자의 요양보호사 추가 정보를 입력받는 화면을 렌더링한다.
    @GetMapping({"/caregiver-info", "/caregiver_info.html"})
    public String caregiverInfoPage() {
        return "caregiver_info";
    }

    // 수급자 목록 화면을 렌더링한다.
    @GetMapping({"/manage-seniors", "/manage_seniors.html"})
    public String manageSeniors() {
        return "manage_seniors";
    }

    // 선택한 수급자의 상세 화면을 렌더링한다.
    @GetMapping({"/manage-seniors/detail", "/manage_seniors_detail.html"})
    public String manageSeniorsDetail() {
        return "manage_seniors_detail";
    }

    // 수급자 수정 화면을 렌더링한다.
    @GetMapping("/manage-seniors/edit")
    public String manageSeniorsEdit() {
        return "manage_seniors_edit";
    }

    // 수급자 등록 화면을 렌더링한다.
    @GetMapping("/manage-seniors/create")
    public String manageSeniorsCreate() {
        return "manage_seniors_create";
    }

    // 프로필 수정 화면을 렌더링한다.
    @GetMapping({"/profile-edit", "/profile_edit.html"})
    public String profileEdit() {
        return "profile_edit";
    }

    // 리포트 화면을 렌더링한다.
    @GetMapping({"/report", "/report.html"})
    public String reportPage() {
        return "report";
    }

    // 테스트 화면을 렌더링한다.
    @GetMapping({"/test", "/test.html"})
    public String testPage() {
        return "test";
    }

    // 훈련 선택 화면을 렌더링한다.
    @GetMapping({"/training", "/training.html"})
    public String trainingPage() {
        return "training";
    }

    // 실제 훈련 프로그램 화면을 렌더링한다.
    @GetMapping({"/training-program", "/training_program.html"})
    public String trainingProgramPage() {
        return "training_program";
    }
}
