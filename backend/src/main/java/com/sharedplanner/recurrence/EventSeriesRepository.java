package com.sharedplanner.recurrence;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;
public interface EventSeriesRepository extends JpaRepository<EventSeries, UUID> {
    Optional<EventSeries> findBySourceKey(String sourceKey);
}
