package com.sharedplanner.recurrence;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "event_series")
public class EventSeries {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @Column(name="calendar_id", nullable=false) private UUID calendarId;
    @Column(nullable=false, length=16) private String frequency;
    @Column(name="zone_id", nullable=false, length=80) private String zoneId;
    @Column(name="source_key", unique=true, length=64) private String sourceKey;
    @Column(name="recurrence_rule", columnDefinition="text") private String recurrenceRule;
    @Column(name="created_at", nullable=false) private LocalDateTime createdAt;
    protected EventSeries() { }
    public EventSeries(UUID calendarId, String frequency, String zoneId, String sourceKey, String recurrenceRule) {
        this.calendarId=calendarId; this.frequency=frequency; this.zoneId=zoneId;
        this.sourceKey=sourceKey; this.recurrenceRule=recurrenceRule; this.createdAt=LocalDateTime.now();
    }
    public UUID getId() { return id; }
    public UUID getCalendarId() { return calendarId; }
    public String getFrequency() { return frequency; }
    public String getZoneId() { return zoneId; }
    public String getRecurrenceRule() { return recurrenceRule; }
}
