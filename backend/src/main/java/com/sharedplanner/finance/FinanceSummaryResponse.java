package com.sharedplanner.finance;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Resumo financeiro de eventos CLIENT não cancelados pela equipe.
 * <ul>
 *   <li>expected/pending excluem atendimentos desmarcados pelo cliente;</li>
 *   <li>received inclui todo valor efetivamente recebido (inclusive de desmarcados);</li>
 *   <li>contagens de pagamento e de confirmação são, cada uma, mutuamente exclusivas
 *       sobre {@code appointmentCount};</li>
 *   <li>{@code unscheduledAmount} é valor associado a desmarcações, não prejuízo.</li>
 * </ul>
 */
public record FinanceSummaryResponse(
        UUID calendarId,
        LocalDate startDate,
        LocalDate endDate,
        BigDecimal expectedAmount,
        BigDecimal receivedAmount,
        BigDecimal pendingAmount,
        Long appointmentCount,
        Long paidCount,
        Long pendingCount,
        Long partiallyPaidCount,
        Long refundedCount,
        BigDecimal confirmedAmount,
        BigDecimal unconfirmedAmount,
        BigDecimal unscheduledAmount,
        Long confirmedCount,
        Long awaitingConfirmationCount,
        Long rescheduledCount,
        Long unscheduledCount,
        Long rescheduleOccurrences
) {
}
