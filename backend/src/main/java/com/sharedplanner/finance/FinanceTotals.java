package com.sharedplanner.finance;

import java.math.BigDecimal;

public interface FinanceTotals {

    BigDecimal getExpectedAmount();

    BigDecimal getReceivedAmount();

    Long getAppointmentCount();

    Long getPaidCount();

    Long getPendingCount();

    Long getPartiallyPaidCount();

    Long getRefundedCount();
}
