package com.example.final_project.report;

import com.example.final_project.report.dto.PerformanceReportResponse;
import com.example.final_project.report.dto.PerformanceReportSummaryResponse;
import com.example.final_project.report.dto.TrendReportResponse;
import com.example.final_project.user.CurrentUserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.multipart.MultipartFile;
import java.util.Map;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/reports")
public class ReportController {

    private static final Logger log = LoggerFactory.getLogger(ReportController.class);

    private final ReportService reportService;
    private final CurrentUserService currentUserService;

    public ReportController(
            ReportService reportService,
            CurrentUserService currentUserService
    ) {
        this.reportService = reportService;
        this.currentUserService = currentUserService;
    }

    @GetMapping("/recipients/{recipientId}/performances")
    public List<PerformanceReportSummaryResponse> getAvailableReports(@PathVariable Long recipientId) {
        return reportService.getAvailableReports(recipientId, currentUserService.getRequiredUserId());
    }

    @GetMapping("/recipients/{recipientId}/performances/{performanceId}")
    public PerformanceReportResponse getPerformanceReport(
            @PathVariable Long recipientId,
            @PathVariable Long performanceId
    ) {
        return reportService.getPerformanceReport(recipientId, performanceId, currentUserService.getRequiredUserId());
    }

    @GetMapping("/recipients/{recipientId}/trend")
    public TrendReportResponse getTrendReport(
            @PathVariable Long recipientId,
            @RequestParam(defaultValue = "7") int days
    ) {
        return reportService.getTrendReport(recipientId, days, currentUserService.getRequiredUserId());
    }

    @PostMapping(value = "/pdf-files", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseBody
    public Map<String, String> uploadReportPdf(
            @RequestParam("recipientId") Long recipientId,
            @RequestParam("performanceId") Long performanceId,
            @RequestParam("pdfFile") MultipartFile pdfFile
    ) throws Exception {
        log.info(
                "Report PDF upload requested. recipientId={}, performanceId={}, originalFileName={}, size={}",
                recipientId,
                performanceId,
                pdfFile.getOriginalFilename(),
                pdfFile.getSize()
        );
        String savedPath = reportService.saveReportPdfPath(
                recipientId,
                performanceId,
                currentUserService.getRequiredUserId(),
                pdfFile.getOriginalFilename(),
                pdfFile.getBytes()
        );
        log.info("Report PDF upload saved. recipientId={}, performanceId={}, path={}", recipientId, performanceId, savedPath);
        return Map.of("pdfFilePath", savedPath);
    }
}
