ALTER TABLE dbo.users
ADD created_by_user_id UNIQUEIDENTIFIER NULL,
    updated_by_user_id UNIQUEIDENTIFIER NULL;
GO

ALTER TABLE dbo.users
ADD CONSTRAINT fk_users_created_by_user
    FOREIGN KEY (created_by_user_id) REFERENCES dbo.users (id);
GO

ALTER TABLE dbo.users
ADD CONSTRAINT fk_users_updated_by_user
    FOREIGN KEY (updated_by_user_id) REFERENCES dbo.users (id);
GO

ALTER TABLE dbo.calendars
ADD created_by_user_id UNIQUEIDENTIFIER NULL,
    updated_at DATETIME2 NULL,
    updated_by_user_id UNIQUEIDENTIFIER NULL;
GO

UPDATE dbo.calendars
SET created_by_user_id = owner_user_id
WHERE created_by_user_id IS NULL;
GO

ALTER TABLE dbo.calendars
ADD CONSTRAINT fk_calendars_created_by_user
    FOREIGN KEY (created_by_user_id) REFERENCES dbo.users (id);
GO

ALTER TABLE dbo.calendars
ADD CONSTRAINT fk_calendars_updated_by_user
    FOREIGN KEY (updated_by_user_id) REFERENCES dbo.users (id);
GO

ALTER TABLE dbo.calendar_members
ADD created_by_user_id UNIQUEIDENTIFIER NULL,
    updated_at DATETIME2 NULL,
    updated_by_user_id UNIQUEIDENTIFIER NULL;
GO

ALTER TABLE dbo.calendar_members
ADD CONSTRAINT fk_calendar_members_created_by_user
    FOREIGN KEY (created_by_user_id) REFERENCES dbo.users (id);
GO

ALTER TABLE dbo.calendar_members
ADD CONSTRAINT fk_calendar_members_updated_by_user
    FOREIGN KEY (updated_by_user_id) REFERENCES dbo.users (id);
GO

ALTER TABLE dbo.events
ADD updated_by_user_id UNIQUEIDENTIFIER NULL;
GO

UPDATE dbo.events
SET updated_by_user_id = created_by_user_id
WHERE updated_by_user_id IS NULL;
GO

ALTER TABLE dbo.events
ADD CONSTRAINT fk_events_updated_by_user
    FOREIGN KEY (updated_by_user_id) REFERENCES dbo.users (id);
GO
