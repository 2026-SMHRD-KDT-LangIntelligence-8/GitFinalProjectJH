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

    @GetMapping({"/main", "/main.html"})
    public String mainPage() {
        return "main";
    }

    @GetMapping({"/manage-seniors", "/manage_seniors.html"})
    public String manageSeniors() {
        return "manage_seniors";
    }

    @GetMapping({"/manage-seniors/detail", "/manage_seniors_detail.html"})
    public String manageSeniorsDetail() {
        return "manage_seniors_detail";
    }

    @GetMapping("/manage-seniors/edit")
    public String manageSeniorsEdit() {
        return "manage_seniors_edit";
    }

    @GetMapping("/manage-seniors/create")
    public String manageSeniorsCreate() {
        return "manage_seniors_create";
    }

    @GetMapping({"/profile-edit", "/profile_edit.html"})
    public String profileEdit() {
        return "profile_edit";
    }

    @GetMapping({"/report", "/report.html"})
    public String reportPage() {
        return "report";
    }

    @GetMapping({"/test", "/test.html"})
    public String testPage() {
        return "test";
    }

    @GetMapping({"/training", "/training.html"})
    public String trainingPage() {
        return "training";
    }

    @GetMapping({"/training-program", "/training_program.html"})
    public String trainingProgramPage() {
        return "training_program";
    }
}
