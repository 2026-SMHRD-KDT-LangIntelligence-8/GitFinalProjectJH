package com.example.final_project.report;

import com.example.final_project.report.dto.CreateShareLinkRequest;
import com.example.final_project.report.dto.PerformanceReportResponse;
import com.example.final_project.report.dto.PerformanceReportSummaryResponse;
import com.example.final_project.report.dto.ShareLinkResponse;
import com.example.final_project.report.dto.TrendReportResponse;
import com.example.final_project.user.CurrentUserService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.multipart.MultipartFile;
import java.util.Map;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/reports")
public class ReportController {

    private final ReportService reportService;
    private final CurrentUserService currentUserService;
    private final ReportShareTokenService reportShareTokenService;

    public ReportController(
            ReportService reportService,
            CurrentUserService currentUserService,
            ReportShareTokenService reportShareTokenService
    ) {
        this.reportService = reportService;
        this.currentUserService = currentUserService;
        this.reportShareTokenService = reportShareTokenService;
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

    @PostMapping("/share-links")
    public ShareLinkResponse createShareLink(
            @RequestBody CreateShareLinkRequest request,
            HttpServletRequest httpServletRequest
    ) {
        String userId = currentUserService.getRequiredUserId();
        PerformanceReportResponse report = reportService.getPerformanceReport(
                request.recipientId(),
                request.performanceId(),
                userId
        );

        ReportShareTokenService.ShareTokenPayload tokenPayload = reportShareTokenService.createToken(
                userId,
                request.recipientId(),
                request.performanceId()
        );

        String shareUrl = httpServletRequest.getScheme()
                + "://"
                + httpServletRequest.getServerName()
                + ":"
                + httpServletRequest.getServerPort()
                + "/reports/shared?token="
                + tokenPayload.token();

        return new ShareLinkResponse(
                shareUrl,
                report.recipientName() + " ???",
                report.performedAt() + " ?? ??? ??? ? ?? ?? ?????.",
                tokenPayload.expiresAt().toString()
        );
    }

    @GetMapping("/shared")
    public PerformanceReportResponse getSharedReport(@RequestParam String token) {
        ReportShareTokenService.ShareTokenPayload payload = reportShareTokenService.parseToken(token);
        return reportService.getPerformanceReport(
                payload.recipientId(),
                payload.performanceId(),
                payload.userId()
        );

    }
    @PostMapping(value = "/pdf-files", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseBody
    public Map<String, String> uploadReportPdf(
            @RequestParam("recipientId") Long recipientId,
            @RequestParam("performanceId") Long performanceId,
            @RequestParam("pdfFile") MultipartFile pdfFile
    ) throws Exception {
        String savedPath = reportService.saveReportPdfPath(
                recipientId,
                performanceId,
                currentUserService.getRequiredUserId(),
                pdfFile.getOriginalFilename(),
                pdfFile.getBytes()
        );
        return Map.of("pdfFilePath", savedPath);
    }
}
