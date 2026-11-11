package com.sharedplanner.finance;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/finance")
public class FinanceController {

    private final FinanceService financeService;

    public FinanceController(FinanceService financeService) {
        this.financeService = financeService;
    }

    @GetMapping("/summary")
    public FinanceSummaryResponse summarize(
            @RequestParam UUID calendarId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            Authentication authentication
    ) {
        return financeService.summarize(calendarId, startDate, endDate, authentication);
    }

    @GetMapping("/timeline")
    public FinanceTimelineResponse timeline(
            @RequestParam UUID calendarId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            Authentication authentication
    ) {
        return financeService.timeline(calendarId, startDate, endDate, authentication);
    }

    @GetMapping("/appointments")
    public List<FinanceAppointmentResponse> appointments(
            @RequestParam UUID calendarId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) Integer limit,
            Authentication authentication
    ) {
        return financeService.appointments(calendarId, startDate, endDate, limit, authentication);
    }
}
