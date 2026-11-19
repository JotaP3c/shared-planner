package com.sharedplanner.event;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record EventCatalogQuote(List<EventCatalogItem> catalogItems, BigDecimal amount) {
    public record Request(
            @NotNull UUID calendarId,
            @NotNull LocalDate appointmentDate,
            @NotNull @Size(min = 1, max = 50) List<@NotNull @Valid CatalogItemSelection> catalogItems
    ) {
    }
}
