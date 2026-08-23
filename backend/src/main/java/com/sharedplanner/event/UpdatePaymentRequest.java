package com.sharedplanner.event;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record UpdatePaymentRequest(
        @NotNull
        PaymentStatus paymentStatus,

        PaymentMethod paymentMethod,

        @DecimalMin(value = "0.00", inclusive = true)
        @Digits(integer = 10, fraction = 2)
        BigDecimal receivedAmount,

        LocalDateTime paidAt
) {
}
