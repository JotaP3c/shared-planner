-- Finite materialized occurrences preserve the existing event/finance/approval semantics.
ALTER TABLE events ADD COLUMN external_source VARCHAR(30) NULL;
CREATE TABLE event_series (
    id UUID PRIMARY KEY,
    calendar_id UUID NOT NULL REFERENCES calendars(id),
    frequency VARCHAR(16) NOT NULL,
    zone_id VARCHAR(80) NOT NULL,
    source_key VARCHAR(64) UNIQUE,
    recurrence_rule TEXT,
    created_at TIMESTAMP NOT NULL
);
CREATE TABLE series_occurrences (
    id UUID PRIMARY KEY,
    series_id UUID NOT NULL REFERENCES event_series(id),
    event_id UUID NOT NULL UNIQUE REFERENCES events(id),
    original_starts_at TIMESTAMP NOT NULL
);
CREATE INDEX ix_series_occurrence_order ON series_occurrences(series_id,original_starts_at);
CREATE TABLE imported_calendar_events (
    id UUID PRIMARY KEY,
    identity_key VARCHAR(64) NOT NULL UNIQUE,
    source VARCHAR(30) NOT NULL,
    source_calendar_id VARCHAR(512) NOT NULL,
    external_uid VARCHAR(1024) NOT NULL,
    recurrence_id VARCHAR(80) NOT NULL,
    target_calendar_id UUID NOT NULL REFERENCES calendars(id),
    event_id UUID NOT NULL REFERENCES events(id),
    imported_at TIMESTAMP NOT NULL
);
