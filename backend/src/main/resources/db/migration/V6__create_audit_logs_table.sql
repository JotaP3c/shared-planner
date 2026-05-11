CREATE TABLE dbo.audit_logs (
    id UNIQUEIDENTIFIER NOT NULL,
    entity_type NVARCHAR(40) NOT NULL,
    entity_id UNIQUEIDENTIFIER NOT NULL,
    calendar_id UNIQUEIDENTIFIER NULL,
    action NVARCHAR(40) NOT NULL,
    summary NVARCHAR(500) NOT NULL,
    old_value NVARCHAR(MAX) NULL,
    new_value NVARCHAR(MAX) NULL,
    performed_by_user_id UNIQUEIDENTIFIER NOT NULL,
    performed_at DATETIME2 NOT NULL,

    CONSTRAINT pk_audit_logs PRIMARY KEY (id),
    CONSTRAINT fk_audit_logs_performed_by_user
        FOREIGN KEY (performed_by_user_id) REFERENCES dbo.users (id)
);
GO

CREATE INDEX ix_audit_logs_entity
ON dbo.audit_logs(entity_type, entity_id);
GO

CREATE INDEX ix_audit_logs_calendar
ON dbo.audit_logs(calendar_id, performed_at);
GO

CREATE INDEX ix_audit_logs_performed_at
ON dbo.audit_logs(performed_at);
GO
