package com.sharedplanner.calendarimport;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/calendar-imports")
public class CalendarImportController {
    private final CalendarImportService service;
    public CalendarImportController(CalendarImportService service) { this.service=service; }
    @PostMapping("/preview")
    public CalendarImportService.ImportResponse preview(@Valid @RequestBody CalendarImportRequest request,Authentication authentication) { return service.preview(request,authentication); }
    @PostMapping("/commit")
    public CalendarImportService.ImportResponse commit(@Valid @RequestBody CalendarImportRequest request,Authentication authentication) { return service.commit(request,authentication); }
}
