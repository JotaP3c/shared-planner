package com.sharedplanner.finance;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Evolução financeira por dia (até 62 dias) ou por mês; buckets sem atendimentos valem zero. */
public record FinanceTimelineResponse(
        UUID calendarId,
        LocalDate startDate,
        LocalDate endDate,
        Granularity granularity,
        List<Point> points
) {
    public enum Granularity { DAY, MONTH }

    public record Point(
            LocalDate date,
            BigDecimal expectedAmount,
            BigDecimal receivedAmount,
            long appointmentCount
    ) {
    }
}
