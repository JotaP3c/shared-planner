package com.sharedplanner.recurrence;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
public interface SeriesOccurrenceRepository extends JpaRepository<SeriesOccurrence, UUID> {
    List<SeriesOccurrence> findBySeriesIdOrderByOriginalStartsAtAsc(UUID seriesId);
    Optional<SeriesOccurrence> findByEventId(UUID eventId);
}
