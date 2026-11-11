-- Confirmação de atendimento pelo cliente (independente de status do evento e de pagamento).
-- Migration não destrutiva: só adiciona colunas/tabela e classifica o legado.
ALTER TABLE events
    ADD COLUMN confirmation_status VARCHAR(30) NULL,
    ADD COLUMN confirmation_changed_at TIMESTAMP NULL,
    ADD COLUMN confirmation_changed_by_user_id UUID NULL,
    ADD COLUMN reschedule_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN unschedule_reason VARCHAR(30) NULL,
    ADD COLUMN unschedule_notes VARCHAR(500) NULL,
    ADD CONSTRAINT fk_events_confirmation_changed_by_user
        FOREIGN KEY (confirmation_changed_by_user_id) REFERENCES users (id),
    ADD CONSTRAINT ck_events_confirmation_status CHECK (
        confirmation_status IS NULL
        OR confirmation_status IN ('PENDING_CONFIRMATION', 'CONFIRMED', 'CANCELLED', 'RESCHEDULED')
    ),
    ADD CONSTRAINT ck_events_unschedule_reason CHECK (
        unschedule_reason IS NULL OR unschedule_reason IN ('RESCHEDULE', 'GAVE_UP', 'OTHER')
    ),
    ADD CONSTRAINT ck_events_reschedule_count CHECK (reschedule_count >= 0);

-- Legado: nenhum atendimento antigo é presumido confirmado.
UPDATE events
SET confirmation_status = 'PENDING_CONFIRMATION'
WHERE event_type = 'CLIENT'
  AND confirmation_status IS NULL;

CREATE TABLE appointment_confirmation_history (
    id UUID NOT NULL,
    event_id UUID NOT NULL,
    previous_status VARCHAR(30) NULL,
    new_status VARCHAR(30) NOT NULL,
    reason VARCHAR(30) NULL,
    notes VARCHAR(500) NULL,
    previous_starts_at TIMESTAMP NULL,
    previous_ends_at TIMESTAMP NULL,
    new_starts_at TIMESTAMP NULL,
    new_ends_at TIMESTAMP NULL,
    performed_by_user_id UUID NOT NULL,
    performed_at TIMESTAMP NOT NULL,
    CONSTRAINT pk_appointment_confirmation_history PRIMARY KEY (id),
    CONSTRAINT fk_confirmation_history_event
        FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE,
    CONSTRAINT fk_confirmation_history_performed_by
        FOREIGN KEY (performed_by_user_id) REFERENCES users (id),
    CONSTRAINT ck_confirmation_history_new_status CHECK (
        new_status IN ('PENDING_CONFIRMATION', 'CONFIRMED', 'CANCELLED', 'RESCHEDULED')
    )
);

CREATE INDEX ix_confirmation_history_event
    ON appointment_confirmation_history (event_id, performed_at);
