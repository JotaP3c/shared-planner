package com.sharedplanner.event;

import java.time.LocalDateTime;
import java.util.UUID;

public record EventSearchResponse(
        UUID id,
        UUID calendarId,
        String calendarName,
        String createdByEmail,
        String approvalRequestedFromEmail,
        EventType eventType,
        EventStatus status,
        String title,
        String clientName,
        String personName,
        LocalDateTime startsAt,
        LocalDateTime endsAt
) {
    static EventSearchResponse from(Event event) {
        return new EventSearchResponse(
                event.getId(),
                event.getCalendar().getId(),
                event.getCalendar().getName(),
                event.getCreatedBy().getEmail(),
                event.getApprovalRequestedFrom() == null ? null : event.getApprovalRequestedFrom().getEmail(),
                event.getEventType(),
                event.getStatus(),
                event.getTitle(),
                event.getClientName(),
                event.getPersonName(),
                event.getStartsAt(),
                event.getEndsAt()
        );
    }
}
