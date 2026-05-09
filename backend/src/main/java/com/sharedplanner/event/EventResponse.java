package com.sharedplanner.event;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public record EventResponse(
        UUID id,
        UUID calendarId,
        String createdByEmail,
        String approvalRequestedFromEmail,
        String approvedByEmail,
        EventType eventType,
        EventStatus status,
        String title,
        String clientName,
        String personName,
        String description,
        String workDescription,
        BigDecimal amount,
        LocalDateTime startsAt,
        LocalDateTime endsAt
) {
    static EventResponse from(Event event) {
        return new EventResponse(
                event.getId(),
                event.getCalendar().getId(),
                event.getCreatedBy().getEmail(),
                event.getApprovalRequestedFrom() == null ? null : event.getApprovalRequestedFrom().getEmail(),
                event.getApprovedBy() == null ? null : event.getApprovedBy().getEmail(),
                event.getEventType(),
                event.getStatus(),
                event.getTitle(),
                event.getClientName(),
                event.getPersonName(),
                event.getDescription(),
                event.getWorkDescription(),
                event.getAmount(),
                event.getStartsAt(),
                event.getEndsAt()
        );
    }
}
