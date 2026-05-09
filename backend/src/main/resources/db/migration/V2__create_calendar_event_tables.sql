CREATE TABLE calendars (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL,
    owner_user_id UUID NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_calendars PRIMARY KEY (id),
    CONSTRAINT fk_calendars_owner_user
        FOREIGN KEY (owner_user_id) REFERENCES users (id)
);

CREATE TABLE calendar_members (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    calendar_id UUID NOT NULL,
    user_id UUID NOT NULL,
    member_role VARCHAR(30) NOT NULL DEFAULT 'MEMBER',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_calendar_members PRIMARY KEY (id),
    CONSTRAINT uk_calendar_members_calendar_user UNIQUE (calendar_id, user_id),
    CONSTRAINT fk_calendar_members_calendar
        FOREIGN KEY (calendar_id) REFERENCES calendars (id) ON DELETE CASCADE,
    CONSTRAINT fk_calendar_members_user
        FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE events (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    calendar_id UUID NOT NULL,
    created_by_user_id UUID NOT NULL,
    approval_requested_from_user_id UUID NULL,
    approved_by_user_id UUID NULL,

    event_type VARCHAR(30) NOT NULL,
    status VARCHAR(30) NOT NULL,

    title VARCHAR(180) NOT NULL,
    client_name VARCHAR(120) NULL,
    person_name VARCHAR(120) NULL,
    description TEXT NULL,
    work_description TEXT NULL,
    amount NUMERIC(12, 2) NULL,

    starts_at TIMESTAMP NOT NULL,
    ends_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL,

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
