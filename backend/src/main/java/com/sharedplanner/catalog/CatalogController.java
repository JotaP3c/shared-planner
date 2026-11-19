package com.sharedplanner.catalog;

import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/calendars/{calendarId}/catalog")
public class CatalogController {
    private final CatalogService catalog;

    public CatalogController(CatalogService catalog) { this.catalog = catalog; }

    @GetMapping
    public CatalogService.CatalogPage list(@PathVariable UUID calendarId,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) CatalogItemType type,
            @RequestParam(required = false) Boolean active,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate appointmentDate,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "30") int size, Authentication actor) {
        return catalog.list(calendarId, q, type, active, category, appointmentDate, page, size, actor);
    }

    @GetMapping("/{id}")
    public CatalogItemResponse get(@PathVariable UUID calendarId, @PathVariable UUID id,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate appointmentDate,
            Authentication actor) {
        return catalog.get(calendarId, id, appointmentDate, actor);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CatalogItemResponse create(@PathVariable UUID calendarId, @RequestBody @Valid CatalogItemRequest request,
                                      Authentication actor) {
        return catalog.create(calendarId, request, actor);
    }

    @PutMapping("/{id}")
    public CatalogItemResponse update(@PathVariable UUID calendarId, @PathVariable UUID id,
            @RequestBody @Valid CatalogItemRequest request, Authentication actor) {
        return catalog.update(calendarId, id, request, actor);
    }

    @GetMapping("/{id}/price-history")
    public List<CatalogPriceChangeResponse> history(@PathVariable UUID calendarId, @PathVariable UUID id,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "100") int size,
            Authentication actor) {
        return catalog.priceHistory(calendarId, id, page, size, actor);
    }
}
