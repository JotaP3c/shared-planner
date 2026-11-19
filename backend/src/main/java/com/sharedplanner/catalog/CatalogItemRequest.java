package com.sharedplanner.catalog;

import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

public record CatalogItemRequest(
        @NotBlank @Size(max = 180) String name,
        @NotNull CatalogItemType type,
        @Size(max = 60) String code,
        @Size(max = 2000) String description,
        @NotNull @PositiveOrZero @Digits(integer = 10, fraction = 2) BigDecimal standardPrice,
        @PositiveOrZero @Digits(integer = 10, fraction = 2) BigDecimal promotionalPrice,
        LocalDate promotionStartDate,
        LocalDate promotionEndDate,
        @Min(1) @Max(1440) Integer durationMinutes,
        @Size(max = 100) String category,
        @NotNull Boolean active,
        @PositiveOrZero Long version
) {}
