package com.sharedplanner.event;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

import java.math.BigDecimal;
import java.util.UUID;

/** The commercial terms agreed for one line of the appointment. */
@Embeddable
public record EventCatalogItem(
        @Column(name = "catalog_item_id", nullable = false) UUID catalogItemId,
        @Column(name = "item_name", nullable = false, length = 180) String name,
        @Column(name = "quantity", nullable = false) int quantity,
        @Column(name = "unit_price", nullable = false, precision = 12, scale = 2) BigDecimal unitPrice,
        @Column(name = "discount", nullable = false, precision = 12, scale = 2) BigDecimal discount,
        @Column(name = "subtotal", nullable = false, precision = 12, scale = 2) BigDecimal subtotal,
        @Column(name = "duration_minutes") Integer durationMinutes
) {
    EventCatalogItem withQuantity(int nextQuantity) {
        if (nextQuantity == quantity) {
            return this;
        }
        BigDecimal newQuantity = BigDecimal.valueOf(nextQuantity);
        BigDecimal discountPerUnit = discount.divide(BigDecimal.valueOf(quantity));
        return new EventCatalogItem(catalogItemId, name, nextQuantity, unitPrice,
                discountPerUnit.multiply(newQuantity), unitPrice.multiply(newQuantity), durationMinutes);
    }
}
