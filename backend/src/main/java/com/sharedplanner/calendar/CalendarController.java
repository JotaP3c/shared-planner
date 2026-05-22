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

    @GetMapping("/{calendarId}/members")
    public List<CalendarMemberResponse> listMembers(
            @PathVariable UUID calendarId,
            Authentication authentication
    ) {
        return calendarService.listMembers(calendarId, authentication);
    }

    @PutMapping("/{calendarId}/members/{memberId}")
    public CalendarMemberResponse updateMember(
            @PathVariable UUID calendarId,
            @PathVariable UUID memberId,
            @RequestBody @Valid UpdateCalendarMemberRequest request,
            Authentication authentication
    ) {
        return calendarService.updateMember(calendarId, memberId, request, authentication);
    }

    @DeleteMapping("/{calendarId}/members/{memberId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeMember(
            @PathVariable UUID calendarId,
            @PathVariable UUID memberId,
            Authentication authentication
    ) {
        calendarService.removeMember(calendarId, memberId, authentication);
    }
}
