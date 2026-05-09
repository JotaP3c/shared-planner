package com.sharedplanner.calendar;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/calendars")
public class CalendarController {

    private final CalendarService calendarService;

    public CalendarController(CalendarService calendarService) {
        this.calendarService = calendarService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CalendarResponse create(
            @RequestBody @Valid CreateCalendarRequest request,
            Authentication authentication
    ) {
        return calendarService.create(request, authentication);
    }

    @GetMapping
    public List<CalendarResponse> list(Authentication authentication) {
        return calendarService.list(authentication);
    }

    @PostMapping("/{calendarId}/members")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void addMember(
            @PathVariable UUID calendarId,
            @RequestBody @Valid AddCalendarMemberRequest request,
            Authentication authentication
    ) {
        calendarService.addMember(calendarId, request, authentication);
    }
}
