package com.sharedplanner.finance;

import java.math.BigDecimal;

public interface FinanceTotals {

    BigDecimal getExpectedAmount();

    BigDecimal getReceivedAmount();

    BigDecimal getPendingAmount();

    BigDecimal getConfirmedAmount();

    BigDecimal getUnconfirmedAmount();

    BigDecimal getUnscheduledAmount();

    Long getAppointmentCount();

    Long getPaidCount();

    Long getPendingCount();

    Long getPartiallyPaidCount();

    Long getRefundedCount();

    Long getConfirmedCount();

    Long getAwaitingConfirmationCount();

    Long getRescheduledCount();

    Long getUnscheduledCount();

    Long getRescheduleOccurrences();
}
