package com.sharedplanner.finance;

import com.sharedplanner.event.AppointmentConfirmationStatus;
import com.sharedplanner.event.PaymentStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/** Atendimento CLIENT listado no Financeiro (somente para quem tem capacidade financeira). */
public record FinanceAppointmentResponse(
        UUID eventId,
        UUID calendarId,
        LocalDateTime startsAt,
        String clientName,
        String workDescription,
        BigDecimal amount,
        BigDecimal receivedAmount,
        PaymentStatus paymentStatus,
        AppointmentConfirmationStatus confirmationStatus
) {
}
