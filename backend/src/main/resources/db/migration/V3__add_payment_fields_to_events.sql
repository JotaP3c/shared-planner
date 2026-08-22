ALTER TABLE events
    ADD COLUMN payment_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    ADD COLUMN payment_method VARCHAR(30) NULL,
    ADD COLUMN received_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN paid_at TIMESTAMP NULL,
    ADD CONSTRAINT ck_events_received_amount CHECK (received_amount >= 0);
