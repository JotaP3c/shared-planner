package com.sharedplanner.event;

import java.math.BigDecimal;

public interface ClientRevenueTotals {

    BigDecimal getTotalAmount();

    Long getAppointmentCount();
}
