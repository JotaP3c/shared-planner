package com.sharedplanner.calendarimport;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name="imported_calendar_events")
public class ImportedCalendarEvent {
    @Id @GeneratedValue(strategy=GenerationType.UUID) private UUID id;
    @Column(name="identity_key",nullable=false,unique=true,length=64) private String identityKey;
    @Column(nullable=false,length=30) private String source;
    @Column(name="source_calendar_id",nullable=false,length=512) private String sourceCalendarId;
    @Column(name="external_uid",nullable=false,length=1024) private String externalUid;
    @Column(name="recurrence_id",nullable=false,length=80) private String recurrenceId;
    @Column(name="target_calendar_id",nullable=false) private UUID targetCalendarId;
    @Column(name="event_id",nullable=false) private UUID eventId;
    @Column(name="imported_at",nullable=false) private LocalDateTime importedAt;
    protected ImportedCalendarEvent() { }
    public ImportedCalendarEvent(String identityKey,String sourceCalendarId,String externalUid,String recurrenceId,UUID targetCalendarId,UUID eventId) {
        this.identityKey=identityKey; this.source="GOOGLE_ICS"; this.sourceCalendarId=sourceCalendarId;
        this.externalUid=externalUid; this.recurrenceId=recurrenceId; this.targetCalendarId=targetCalendarId;
        this.eventId=eventId; this.importedAt=LocalDateTime.now();
    }
}
