package com.sharedplanner.event;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record UpdateEventRequest(
        @NotNull
        EventType eventType,

        @NotBlank
        @Size(max = 180)
        String title,

        @Size(max = 120)
        String clientName,

        @Size(max = 120)
        String personName,

        String description,

        String workDescription,

        @DecimalMin(value = "0.00", inclusive = true)
        @Digits(integer = 10, fraction = 2)
        BigDecimal amount,

        @NotNull
        LocalDateTime startsAt,

        @NotNull
        LocalDateTime endsAt,

        String approvalRequestedFromEmail
) {
}
