package com.sharedplanner.finance;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

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
        Long refundedCount
) {
}
