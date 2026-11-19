package com.sharedplanner.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Objects;

@Embeddable
public class CatalogPricing {
    @Column(name = "standard_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal standardPrice;

    @Column(name = "promotional_price", precision = 12, scale = 2)
    private BigDecimal promotionalPrice;

    @Column(name = "promotion_start_date")
    private LocalDate promotionStartDate;

    @Column(name = "promotion_end_date")
    private LocalDate promotionEndDate;

    protected CatalogPricing() {}

    CatalogPricing(CatalogItemRequest request) {
        standardPrice = request.standardPrice().setScale(2);
        promotionalPrice = request.promotionalPrice() == null ? null : request.promotionalPrice().setScale(2);
        promotionStartDate = request.promotionStartDate();
        promotionEndDate = request.promotionEndDate();
        if (promotionalPrice == null && promotionStartDate == null && promotionEndDate == null) return;
        if (promotionalPrice == null || promotionStartDate == null || promotionEndDate == null
                || promotionalPrice.compareTo(standardPrice) >= 0 || promotionEndDate.isBefore(promotionStartDate)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "A promotion requires a lower price and an inclusive start and end date in order");
        }
    }

    BigDecimal standardPrice() { return standardPrice; }
    BigDecimal promotionalPrice() { return promotionalPrice; }
    LocalDate promotionStartDate() { return promotionStartDate; }
    LocalDate promotionEndDate() { return promotionEndDate; }

    boolean promotionApplies(LocalDate date) {
        return promotionalPrice != null && !date.isBefore(promotionStartDate) && !date.isAfter(promotionEndDate);
    }

    BigDecimal priceOn(LocalDate date) {
        return promotionApplies(date) ? promotionalPrice : standardPrice;
    }

    boolean sameAs(CatalogPricing other) {
        return standardPrice.equals(other.standardPrice) && Objects.equals(promotionalPrice, other.promotionalPrice)
                && Objects.equals(promotionStartDate, other.promotionStartDate)
                && Objects.equals(promotionEndDate, other.promotionEndDate);
    }
}
