package com.sharedplanner.catalog;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

interface CatalogPriceChangeRepository extends JpaRepository<CatalogPriceChange, UUID> {
    @EntityGraph(attributePaths = "changedBy")
    List<CatalogPriceChange> findByCatalogItemIdOrderByChangedAtDescIdDesc(UUID itemId, Pageable pageable);
}
