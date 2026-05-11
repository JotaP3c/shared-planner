package com.sharedplanner.event;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

public record ClientRevenueSummaryResponse(
        UUID calendarId,
        RevenuePeriod period,
        LocalDate referenceDate,
        LocalDateTime periodStart,
        LocalDateTime periodEndExclusive,
        BigDecimal totalAmount,
        Long appointmentCount
) {
}
