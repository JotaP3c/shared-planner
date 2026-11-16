-- Simulation metadata prevents development values from being presented as real prices.
-- No financial value or classification is changed by this migration.
ALTER TABLE events ADD COLUMN financial_simulation BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE events ADD COLUMN simulation_reference_date DATE NULL;
ALTER TABLE events ADD CONSTRAINT ck_events_simulation_reference
    CHECK (NOT financial_simulation OR simulation_reference_date IS NOT NULL);

-- Explicit private correction plans retain source identities and prior state.
-- Only the guarded local-development operation populates this ledger.
CREATE TABLE development_event_corrections (
    correction_key VARCHAR(180) PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES events(id),
    source_event_id UUID NOT NULL REFERENCES events(id),
    previous_state JSONB,
    applied_state JSONB NOT NULL,
    reference_date DATE NOT NULL,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
