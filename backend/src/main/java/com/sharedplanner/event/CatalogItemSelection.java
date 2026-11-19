package com.sharedplanner.event;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.UUID;

public record CatalogItemSelection(
        @NotNull UUID catalogItemId,
        @NotNull @Min(1) @Max(999) Integer quantity,
        @DecimalMin("0.00") @Digits(integer = 10, fraction = 2) BigDecimal expectedUnitPrice,
        @DecimalMin("0.00") @Digits(integer = 10, fraction = 2) BigDecimal expectedDiscount,
        @Min(0) @Max(1440) Integer expectedDurationMinutes
) {
}
