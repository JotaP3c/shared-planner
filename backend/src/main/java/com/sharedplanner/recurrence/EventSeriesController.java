package com.sharedplanner.recurrence;

import com.sharedplanner.event.UpdateEventRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;

@RestController
@RequestMapping("/api/event-series")
public class EventSeriesController {
    private final EventSeriesService service;
    public EventSeriesController(EventSeriesService service) { this.service=service; }
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public EventSeriesService.SeriesResponse create(@Valid @RequestBody EventSeriesService.CreateSeriesRequest request,Authentication authentication) { return service.create(request,authentication); }
    @GetMapping("/by-event/{eventId}")
    public EventSeriesService.SeriesResponse byEvent(@PathVariable UUID eventId,Authentication authentication) { return service.byEvent(eventId,authentication); }
    @PutMapping("/{id}")
    public EventSeriesService.SeriesResponse update(@PathVariable UUID id,@RequestParam(defaultValue="ALL") EventSeriesService.Scope scope,
            @RequestParam(required=false) UUID fromEventId,@Valid @RequestBody UpdateEventRequest request,Authentication authentication) { return service.update(id,scope,fromEventId,request,authentication); }
    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cancel(@PathVariable UUID id,@RequestParam(defaultValue="ALL") EventSeriesService.Scope scope,
            @RequestParam(required=false) UUID fromEventId,Authentication authentication) { service.cancel(id,scope,fromEventId,authentication); }
}
