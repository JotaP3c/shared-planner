-- Preserve all legacy calendars, events and memberships. Do not infer ownership
-- from event titles or relabel a legacy calendar as personal/shared.
ALTER TABLE calendars ADD COLUMN calendar_type VARCHAR(20) NOT NULL DEFAULT 'LEGACY';
ALTER TABLE calendars ADD CONSTRAINT ck_calendars_type CHECK (calendar_type IN ('LEGACY', 'PERSONAL', 'SHARED', 'IMPORTED'));
CREATE UNIQUE INDEX uk_calendars_personal_owner ON calendars (owner_user_id) WHERE calendar_type = 'PERSONAL';

-- Exactly one new, isolated personal calendar per existing user. No event is moved.
INSERT INTO calendars (id, name, owner_user_id, calendar_type, created_by_user_id, created_at)
SELECT gen_random_uuid(), LEFT('Calendário de ' || u.full_name, 120), u.id, 'PERSONAL', u.id, CURRENT_TIMESTAMP
FROM users u
WHERE NOT EXISTS (SELECT 1 FROM calendars c WHERE c.owner_user_id = u.id AND c.calendar_type = 'PERSONAL');
INSERT INTO calendar_members (id, calendar_id, user_id, member_role, created_by_user_id, created_at)
SELECT gen_random_uuid(), c.id, c.owner_user_id, 'ADMIN', c.owner_user_id, CURRENT_TIMESTAMP
FROM calendars c
WHERE c.calendar_type = 'PERSONAL'
  AND NOT EXISTS (SELECT 1 FROM calendar_members cm WHERE cm.calendar_id = c.id AND cm.user_id = c.owner_user_id);

CREATE TABLE calendar_member_roles (
    member_id UUID NOT NULL REFERENCES calendar_members (id) ON DELETE CASCADE,
    role VARCHAR(30) NOT NULL,
    CONSTRAINT pk_calendar_member_roles PRIMARY KEY (member_id, role),
    CONSTRAINT ck_calendar_member_roles CHECK (role IN ('ADMIN', 'EDITOR', 'VIEWER', 'FINANCE'))
);
INSERT INTO calendar_member_roles (member_id, role) SELECT id, member_role FROM calendar_members;

ALTER TABLE events ADD COLUMN client_phone VARCHAR(11) NULL;
ALTER TABLE events ADD COLUMN all_day BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE events ADD COLUMN approval_round INTEGER NOT NULL DEFAULT 0;
ALTER TABLE events ADD CONSTRAINT ck_events_approval_round CHECK (approval_round >= 0);
ALTER TABLE events ADD CONSTRAINT ck_events_client_phone CHECK (client_phone IS NULL OR client_phone ~ '^[1-9][0-9]9[0-9]{8}$');

CREATE TABLE event_approvals (
    id UUID NOT NULL PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES events (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users (id),
    approval_round INTEGER NOT NULL CHECK (approval_round > 0),
    status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    requested_at TIMESTAMP NOT NULL,
    responded_at TIMESTAMP NULL,
    CONSTRAINT uk_event_approval_round_user UNIQUE (event_id, user_id, approval_round)
);
CREATE INDEX ix_event_approvals_user_status ON event_approvals (user_id, status, event_id);
-- Existing singular approvals remain unchanged and keep their original policy.
-- Existing description/work_description columns are retained; the API combines
-- distinct legacy texts for display and uses a single description on future edits.
