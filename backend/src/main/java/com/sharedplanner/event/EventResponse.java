package com.sharedplanner.event;

import com.fasterxml.jackson.annotation.JsonInclude;

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
        @JsonInclude(JsonInclude.Include.NON_NULL)
        BigDecimal amount,
        @JsonInclude(JsonInclude.Include.NON_NULL)
        PaymentStatus paymentStatus,
        @JsonInclude(JsonInclude.Include.NON_NULL)
        PaymentMethod paymentMethod,
        @JsonInclude(JsonInclude.Include.NON_NULL)
        BigDecimal receivedAmount,
        @JsonInclude(JsonInclude.Include.NON_NULL)
        LocalDateTime paidAt,
        LocalDateTime startsAt,
        LocalDateTime endsAt,
        // Confirmação do atendimento (somente CLIENT; não é dado financeiro).
        @JsonInclude(JsonInclude.Include.NON_NULL)
        AppointmentConfirmationStatus confirmationStatus,
        @JsonInclude(JsonInclude.Include.NON_NULL)
        LocalDateTime confirmationChangedAt,
        @JsonInclude(JsonInclude.Include.NON_NULL)
        String confirmationChangedByEmail,
        @JsonInclude(JsonInclude.Include.NON_NULL)
        Integer rescheduleCount,
        @JsonInclude(JsonInclude.Include.NON_NULL)
        UnscheduleReason unscheduleReason,
        @JsonInclude(JsonInclude.Include.NON_NULL)
        String unscheduleNotes
) {
    static EventResponse from(Event event, boolean includeFinancialData) {
        boolean client = event.getEventType() == EventType.CLIENT;

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
                includeFinancialData ? event.getAmount() : null,
                includeFinancialData ? event.getPaymentStatus() : null,
                includeFinancialData ? event.getPaymentMethod() : null,
                includeFinancialData ? event.getReceivedAmount() : null,
                includeFinancialData ? event.getPaidAt() : null,
                event.getStartsAt(),
                event.getEndsAt(),
                client ? event.effectiveConfirmationStatus() : null,
                client ? event.getConfirmationChangedAt() : null,
                client && event.getConfirmationChangedBy() != null ? event.getConfirmationChangedBy().getEmail() : null,
                client ? event.getRescheduleCount() : null,
                client ? event.getUnscheduleReason() : null,
                client ? event.getUnscheduleNotes() : null
        );
    }
}
