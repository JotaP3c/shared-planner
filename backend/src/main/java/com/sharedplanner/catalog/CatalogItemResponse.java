package com.sharedplanner.catalog;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record CatalogItemResponse(
        UUID id,
        UUID calendarId,
        String name,
        CatalogItemType type,
        String code,
        String description,
        BigDecimal standardPrice,
        BigDecimal promotionalPrice,
        LocalDate promotionStartDate,
        LocalDate promotionEndDate,
        Integer durationMinutes,
        String category,
        boolean active,
        BigDecimal effectivePrice,
        boolean promotionApplied,
        long version
) {
    static CatalogItemResponse from(CatalogItem item, LocalDate date) {
        CatalogPricing pricing = item.pricing();
        return new CatalogItemResponse(item.id(), item.calendarId(), item.name(), item.type(), item.code(),
                item.description(), pricing.standardPrice(), pricing.promotionalPrice(), pricing.promotionStartDate(),
                pricing.promotionEndDate(), item.durationMinutes(), item.category(), item.active(),
                pricing.priceOn(date), pricing.promotionApplies(date), item.version());
    }
}
