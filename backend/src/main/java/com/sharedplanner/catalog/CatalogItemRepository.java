package com.sharedplanner.catalog;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CatalogItemRepository extends JpaRepository<CatalogItem, UUID> {
    Optional<CatalogItem> findByCalendarIdAndId(UUID calendarId, UUID id);

    @Query("""
            select i from CatalogItem i where i.calendarId = :calendarId
              and (:active is null or i.active = :active)
              and (:type is null or i.type = :type)
              and (:category = '' or lower(i.category) = :category)
              and (:search = '' or locate(:search, lower(i.name)) > 0
                  or locate(:search, lower(i.code)) > 0 or locate(:search, lower(i.description)) > 0)
            order by lower(i.name), i.id
            """)
    Page<CatalogItem> search(@Param("calendarId") UUID calendarId, @Param("search") String search,
                             @Param("type") CatalogItemType type, @Param("active") Boolean active,
                             @Param("category") String category, Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select i from CatalogItem i where i.calendarId = :calendarId and i.id in :ids
            order by i.id
            """)
    List<CatalogItem> findForUpdate(@Param("calendarId") UUID calendarId, @Param("ids") Collection<UUID> ids);
}
