CREATE TABLE calendars (
    id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
    name NVARCHAR(120) NOT NULL,
    owner_user_id UNIQUEIDENTIFIER NOT NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT pk_calendars PRIMARY KEY (id),
    CONSTRAINT fk_calendars_owner_user
        FOREIGN KEY (owner_user_id) REFERENCES users (id)
);

CREATE TABLE calendar_members (
    id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
    calendar_id UNIQUEIDENTIFIER NOT NULL,
    user_id UNIQUEIDENTIFIER NOT NULL,
    member_role NVARCHAR(30) NOT NULL DEFAULT 'MEMBER',
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT pk_calendar_members PRIMARY KEY (id),
    CONSTRAINT uk_calendar_members_calendar_user UNIQUE (calendar_id, user_id),
    CONSTRAINT fk_calendar_members_calendar
        FOREIGN KEY (calendar_id) REFERENCES calendars (id) ON DELETE CASCADE,
    CONSTRAINT fk_calendar_members_user
        FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE events (
    id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
    calendar_id UNIQUEIDENTIFIER NOT NULL,
    created_by_user_id UNIQUEIDENTIFIER NOT NULL,
    approval_requested_from_user_id UNIQUEIDENTIFIER NULL,
    approved_by_user_id UNIQUEIDENTIFIER NULL,

    event_type NVARCHAR(30) NOT NULL,
    status NVARCHAR(30) NOT NULL,

    title NVARCHAR(180) NOT NULL,
    client_name NVARCHAR(120) NULL,
    person_name NVARCHAR(120) NULL,
    description NVARCHAR(MAX) NULL,
    work_description NVARCHAR(MAX) NULL,
    amount DECIMAL(12, 2) NULL,

    starts_at DATETIME2 NOT NULL,
    ends_at DATETIME2 NOT NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NULL,

    CONSTRAINT pk_events PRIMARY KEY (id),
    CONSTRAINT fk_events_calendar
        FOREIGN KEY (calendar_id) REFERENCES calendars (id) ON DELETE CASCADE,
    CONSTRAINT fk_events_created_by_user
        FOREIGN KEY (created_by_user_id) REFERENCES users (id),
    CONSTRAINT fk_events_approval_requested_from_user
        FOREIGN KEY (approval_requested_from_user_id) REFERENCES users (id),
    CONSTRAINT fk_events_approved_by_user
        FOREIGN KEY (approved_by_user_id) REFERENCES users (id),
    CONSTRAINT ck_events_period CHECK (ends_at > starts_at),
    CONSTRAINT ck_events_amount CHECK (amount IS NULL OR amount >= 0)
);
