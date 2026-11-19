package com.sharedplanner.catalog;

import com.sharedplanner.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "catalog_price_history")
public class CatalogPriceChange {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "catalog_item_id", nullable = false, updatable = false)
    private UUID catalogItemId;

    @Embedded
    private CatalogPricing pricing;

    @Column(name = "changed_at", nullable = false, updatable = false)
    private LocalDateTime changedAt;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "changed_by_user_id", nullable = false, updatable = false)
    private User changedBy;

    protected CatalogPriceChange() {}

    CatalogPriceChange(CatalogItem item, User actor) {
        catalogItemId = item.id();
        pricing = item.pricing();
        changedAt = LocalDateTime.now();
        changedBy = actor;
    }

    CatalogPricing pricing() { return pricing; }
    LocalDateTime changedAt() { return changedAt; }
    String changedByEmail() { return changedBy.getEmail(); }
}
