package com.sharedplanner.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.util.UUID;

@Entity
@Table(name = "catalog_items")
public class CatalogItem {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "calendar_id", nullable = false, updatable = false)
    private UUID calendarId;

    @Column(nullable = false, length = 180)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "item_type", nullable = false, length = 20)
    private CatalogItemType type;

    @Column(length = 60)
    private String code;

    @Column(length = 2000)
    private String description;

    @Column(length = 100)
    private String category;

    @Column(name = "duration_minutes")
    private Integer durationMinutes;

    @Embedded
    private CatalogPricing pricing;

    @Column(nullable = false)
    private boolean active;

    @Version
    @Column(nullable = false)
    private long version;

    protected CatalogItem() {}

    CatalogItem(UUID calendarId, CatalogItemRequest request, CatalogPricing pricing) {
        this.calendarId = calendarId;
        update(request, pricing);
    }

    void update(CatalogItemRequest request, CatalogPricing updatedPricing) {
        name = request.name().strip();
        type = request.type();
        code = optionalText(request.code());
        description = optionalText(request.description());
        category = optionalText(request.category());
        durationMinutes = request.durationMinutes();
        pricing = updatedPricing;
        active = request.active();
    }

    private static String optionalText(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }

    UUID id() { return id; }
    UUID calendarId() { return calendarId; }
    String name() { return name; }
    CatalogItemType type() { return type; }
    String code() { return code; }
    String description() { return description; }
    String category() { return category; }
    Integer durationMinutes() { return durationMinutes; }
    CatalogPricing pricing() { return pricing; }
    boolean active() { return active; }
    long version() { return version; }
}
