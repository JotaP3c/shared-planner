package com.sharedplanner.event;

import java.time.LocalDateTime;
import java.util.UUID;

public record ConfirmationHistoryResponse(
        UUID id,
        UUID eventId,
        AppointmentConfirmationStatus previousStatus,
        AppointmentConfirmationStatus newStatus,
        UnscheduleReason reason,
        String notes,
        LocalDateTime previousStartsAt,
        LocalDateTime previousEndsAt,
        LocalDateTime newStartsAt,
        LocalDateTime newEndsAt,
        String performedByEmail,
        LocalDateTime performedAt
) {
    static ConfirmationHistoryResponse from(AppointmentConfirmationHistory history) {
        return new ConfirmationHistoryResponse(
                history.getId(),
                history.getEvent().getId(),
                history.getPreviousStatus(),
                history.getNewStatus(),
                history.getReason(),
                history.getNotes(),
                history.getPreviousStartsAt(),
                history.getPreviousEndsAt(),
                history.getNewStartsAt(),
                history.getNewEndsAt(),
                history.getPerformedBy().getEmail(),
                history.getPerformedAt()
        );
    }
}
