package com.sharedplanner.event;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record UpdateEventRequest(
        @NotNull
        EventType eventType,

        @Size(max = 180)
        String title,

        @Size(max = 120)
        String clientName,

        @Size(max = 120)
        String personName,

        String description,

        String workDescription,

        @DecimalMin(value = "0.00", inclusive = true)
        @Digits(integer = 10, fraction = 2)
        BigDecimal amount,

        @NotNull
        LocalDateTime startsAt,

        @NotNull
        LocalDateTime endsAt,

        String approvalRequestedFromEmail,
        @Size(max = 24) String clientPhone,
        @Size(max = 100) List<String> approvalRequestedFromEmails,
        Boolean allDay,
        @Size(max = 50) List<@NotNull @Valid CatalogItemSelection> catalogItems,
        @Size(max = 500) String observations,
        Boolean repriceCatalogItems,
        @DecimalMin("0.00") @Digits(integer = 10, fraction = 2) BigDecimal expectedCatalogTotal
) {
    public UpdateEventRequest(EventType eventType, String title, String clientName,
            String personName, String description, String workDescription, BigDecimal amount,
            LocalDateTime startsAt, LocalDateTime endsAt, String approvalRequestedFromEmail,
            String clientPhone, List<String> approvalRequestedFromEmails, Boolean allDay) {
        this(eventType, title, clientName, personName, description, workDescription, amount,
                startsAt, endsAt, approvalRequestedFromEmail, clientPhone, approvalRequestedFromEmails, allDay,
                null, null, null, null);
    }
    public UpdateEventRequest(EventType eventType, String title, String clientName,
            String personName, String description, String workDescription, BigDecimal amount,
            LocalDateTime startsAt, LocalDateTime endsAt, String approvalRequestedFromEmail) {
        this(eventType, title, clientName, personName, description, workDescription, amount,
                startsAt, endsAt, approvalRequestedFromEmail, null, null, null);
    }
    public UpdateEventRequest withAllDay(boolean value) {
        return new UpdateEventRequest(eventType, title, clientName, personName, description,
                workDescription, amount, startsAt, endsAt, approvalRequestedFromEmail, clientPhone,
                approvalRequestedFromEmails, value, catalogItems, observations, repriceCatalogItems, expectedCatalogTotal);
    }
    public UpdateEventRequest withPeriod(LocalDateTime start, LocalDateTime end) {
        return new UpdateEventRequest(eventType, title, clientName, personName, description,
                workDescription, amount, start, end, approvalRequestedFromEmail, clientPhone,
                approvalRequestedFromEmails, allDay, catalogItems, observations, repriceCatalogItems, expectedCatalogTotal);
    }
}
