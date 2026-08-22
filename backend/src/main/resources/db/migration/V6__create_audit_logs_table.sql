CREATE TABLE audit_logs (
    id UUID NOT NULL, entity_type VARCHAR(40) NOT NULL, entity_id UUID NOT NULL,
    calendar_id UUID NULL, action VARCHAR(40) NOT NULL, summary VARCHAR(500) NOT NULL,
    old_value TEXT NULL, new_value TEXT NULL, performed_by_user_id UUID NOT NULL,
    performed_at TIMESTAMP NOT NULL,
    CONSTRAINT pk_audit_logs PRIMARY KEY (id),
    CONSTRAINT fk_audit_logs_performed_by_user FOREIGN KEY (performed_by_user_id) REFERENCES users (id)
);
CREATE INDEX ix_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX ix_audit_logs_calendar ON audit_logs(calendar_id, performed_at);
CREATE INDEX ix_audit_logs_performed_at ON audit_logs(performed_at);
