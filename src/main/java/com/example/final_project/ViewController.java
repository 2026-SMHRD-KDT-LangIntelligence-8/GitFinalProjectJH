package com.example.final_project;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class ViewController {

    @GetMapping("/login")
    public String loginPage() {
        return "login";
    }

    @GetMapping("/main")
    public String mainPage() {
        return "main";
    }

    @GetMapping("/manage-seniors")
    public String manageSeniors() {
        return "manage_seniors";
    }

    @GetMapping("/profile-edit")
    public String profileEdit() {
        return "profile_edit";
    }

    @GetMapping("/report")
    public String reportPage() {
        return "report";
    }

    @GetMapping("/test")
    public String testPage() {
        return "test";
    }

    @GetMapping("/training")
    public String trainingPage() {
        return "training";
    }
}