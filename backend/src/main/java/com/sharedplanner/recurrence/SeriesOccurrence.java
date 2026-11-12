package com.sharedplanner.recurrence;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name="series_occurrences", uniqueConstraints=@UniqueConstraint(columnNames="event_id"))
public class SeriesOccurrence {
    @Id @GeneratedValue(strategy=GenerationType.UUID) private UUID id;
    @ManyToOne(fetch=FetchType.LAZY, optional=false) @JoinColumn(name="series_id",nullable=false) private EventSeries series;
    @Column(name="event_id",nullable=false) private UUID eventId;
    @Column(name="original_starts_at",nullable=false) private LocalDateTime originalStartsAt;
    protected SeriesOccurrence() { }
    public SeriesOccurrence(EventSeries series, UUID eventId, LocalDateTime originalStartsAt) {
        this.series=series; this.eventId=eventId; this.originalStartsAt=originalStartsAt;
    }
    public EventSeries getSeries() { return series; }
    public UUID getEventId() { return eventId; }
    public LocalDateTime getOriginalStartsAt() { return originalStartsAt; }
}
