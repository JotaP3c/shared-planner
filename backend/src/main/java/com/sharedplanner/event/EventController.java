package com.sharedplanner.event;

import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/events")
public class EventController {

    private final EventService eventService;

    public EventController(EventService eventService) {
        this.eventService = eventService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public EventResponse create(
            @RequestBody @Valid CreateEventRequest request,
            Authentication authentication
    ) {
        return eventService.create(request, authentication);
    }

    @GetMapping
    public List<EventResponse> list(
            @RequestParam UUID calendarId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime start,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime end,
            Authentication authentication
    ) {
        return eventService.list(calendarId, start, end, authentication);
    }

    @GetMapping("/client-revenue")
    public ClientRevenueSummaryResponse summarizeClientRevenue(
            @RequestParam UUID calendarId,
            @RequestParam RevenuePeriod period,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            Authentication authentication
    ) {
        return eventService.summarizeClientRevenue(calendarId, period, date, authentication);
    }

    @GetMapping("/{eventId}")
    public EventResponse findById(
            @PathVariable UUID eventId,
            Authentication authentication
    ) {
        return eventService.findById(eventId, authentication);
    }

    @PutMapping("/{eventId}")
    public EventResponse update(
            @PathVariable UUID eventId,
            @RequestBody @Valid UpdateEventRequest request,
            Authentication authentication
    ) {
        return eventService.update(eventId, request, authentication);
    }

    @PutMapping("/{eventId}/payment")
    public EventResponse updatePayment(
            @PathVariable UUID eventId,
            @RequestBody @Valid UpdatePaymentRequest request,
            Authentication authentication
    ) {
        return eventService.updatePayment(eventId, request, authentication);
    }

    @DeleteMapping("/{eventId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
            @PathVariable UUID eventId,
            Authentication authentication
    ) {
        eventService.delete(eventId, authentication);
    }

    @PostMapping("/{eventId}/approve")
    public EventResponse approve(
            @PathVariable UUID eventId,
            Authentication authentication
    ) {
        return eventService.approve(eventId, authentication);
    }

    @PostMapping("/{eventId}/reject")
    public EventResponse reject(
            @PathVariable UUID eventId,
            Authentication authentication
    ) {
        return eventService.reject(eventId, authentication);
    }
}
