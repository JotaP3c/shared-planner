package com.sharedplanner.catalog;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record CatalogPriceChangeResponse(
        BigDecimal standardPrice,
        BigDecimal promotionalPrice,
        LocalDate promotionStartDate,
        LocalDate promotionEndDate,
        LocalDateTime changedAt,
        String changedByEmail
) {
    static CatalogPriceChangeResponse from(CatalogPriceChange change) {
        CatalogPricing pricing = change.pricing();
        return new CatalogPriceChangeResponse(pricing.standardPrice(), pricing.promotionalPrice(),
                pricing.promotionStartDate(), pricing.promotionEndDate(), change.changedAt(), change.changedByEmail());
    }
}
