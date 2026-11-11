package com.sharedplanner.event;

/**
 * Situação de confirmação do atendimento pelo cliente (somente eventos CLIENT).
 * Independente de {@link EventStatus} (ciclo do evento) e de {@link PaymentStatus}.
 * CANCELLED aqui significa "desmarcado pelo cliente": o evento permanece registrado para
 * preservar pagamentos e histórico.
 */
public enum AppointmentConfirmationStatus {
    PENDING_CONFIRMATION,
    CONFIRMED,
    CANCELLED,
    RESCHEDULED
}
