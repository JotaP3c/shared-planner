\set ON_ERROR_STOP on
BEGIN;
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;

DO $$
BEGIN
    IF (SELECT count(*) FROM flyway_schema_history WHERE success) <> 7 THEN
        RAISE EXCEPTION 'Flyway V1-V7 nao aplicado';
    END IF;
    IF EXISTS (
        SELECT 1 FROM users UNION ALL SELECT 1 FROM calendars
        UNION ALL SELECT 1 FROM calendar_members UNION ALL SELECT 1 FROM events
        UNION ALL SELECT 1 FROM audit_logs
    ) THEN
        RAISE EXCEPTION 'Target nao esta vazio';
    END IF;
END $$;

WITH src AS (
    SELECT * FROM jsonb_to_recordset(pg_read_file('/tmp/shared-planner-transfer/users.json')::jsonb)
    AS x(id uuid, full_name text, email text, password_hash text, role text, active boolean,
         created_at timestamp, updated_at timestamp, created_by_user_id uuid, updated_by_user_id uuid)
)
INSERT INTO users(id, full_name, email, password_hash, role, active, created_at, updated_at)
SELECT id, full_name, email, password_hash, role, active, created_at, updated_at FROM src;

WITH src AS (
    SELECT * FROM jsonb_to_recordset(pg_read_file('/tmp/shared-planner-transfer/users.json')::jsonb)
    AS x(id uuid, full_name text, email text, password_hash text, role text, active boolean,
         created_at timestamp, updated_at timestamp, created_by_user_id uuid, updated_by_user_id uuid)
)
UPDATE users u
SET created_by_user_id = src.created_by_user_id, updated_by_user_id = src.updated_by_user_id
FROM src WHERE u.id = src.id;

WITH src AS (
    SELECT * FROM jsonb_to_recordset(pg_read_file('/tmp/shared-planner-transfer/calendars.json')::jsonb)
    AS x(id uuid, name text, owner_user_id uuid, created_at timestamp, created_by_user_id uuid,
         updated_at timestamp, updated_by_user_id uuid)
)
INSERT INTO calendars(id, name, owner_user_id, created_at, created_by_user_id, updated_at, updated_by_user_id)
SELECT id, name, owner_user_id, created_at, created_by_user_id, updated_at, updated_by_user_id FROM src;

WITH src AS (
    SELECT * FROM jsonb_to_recordset(pg_read_file('/tmp/shared-planner-transfer/calendar_members.json')::jsonb)
    AS x(id uuid, calendar_id uuid, user_id uuid, member_role text, created_at timestamp,
         created_by_user_id uuid, updated_at timestamp, updated_by_user_id uuid)
)
INSERT INTO calendar_members(id, calendar_id, user_id, member_role, created_at,
                             created_by_user_id, updated_at, updated_by_user_id)
SELECT id, calendar_id, user_id, member_role, created_at,
       created_by_user_id, updated_at, updated_by_user_id FROM src;

WITH src AS (
    SELECT * FROM jsonb_to_recordset(pg_read_file('/tmp/shared-planner-transfer/events.json')::jsonb)
    AS x(id uuid, calendar_id uuid, created_by_user_id uuid, approval_requested_from_user_id uuid,
         approved_by_user_id uuid, event_type text, status text, title text, client_name text,
         person_name text, description text, work_description text, amount numeric(12,2),
         starts_at timestamp, ends_at timestamp, created_at timestamp, updated_at timestamp,
         payment_status text, payment_method text, received_amount numeric(12,2), paid_at timestamp,
         updated_by_user_id uuid)
)
INSERT INTO events(id, calendar_id, created_by_user_id, approval_requested_from_user_id,
                   approved_by_user_id, event_type, status, title, client_name, person_name,
                   description, work_description, amount, starts_at, ends_at, created_at, updated_at,
                   payment_status, payment_method, received_amount, paid_at, updated_by_user_id)
SELECT id, calendar_id, created_by_user_id, approval_requested_from_user_id,
       approved_by_user_id, event_type, status, title, client_name, person_name,
       description, work_description, amount, starts_at, ends_at, created_at, updated_at,
       payment_status, payment_method, received_amount, paid_at, updated_by_user_id FROM src;

WITH src AS (
    SELECT * FROM jsonb_to_recordset(pg_read_file('/tmp/shared-planner-transfer/audit_logs.json')::jsonb)
    AS x(id uuid, entity_type text, entity_id uuid, calendar_id uuid, action text, summary text,
         old_value text, new_value text, performed_by_user_id uuid, performed_at timestamp)
)
INSERT INTO audit_logs(id, entity_type, entity_id, calendar_id, action, summary, old_value,
                       new_value, performed_by_user_id, performed_at)
SELECT id, entity_type, entity_id, calendar_id, action, summary, old_value,
       new_value, performed_by_user_id, performed_at FROM src;

DO $$
BEGIN
    IF (SELECT count(*) FROM users) <> 6
       OR (SELECT count(*) FROM calendars) <> 4
       OR (SELECT count(*) FROM calendar_members) <> 10
       OR (SELECT count(*) FROM events) <> 11
       OR (SELECT count(*) FROM audit_logs) <> 11 THEN
        RAISE EXCEPTION 'Divergencia nas contagens';
    END IF;
    IF coalesce((SELECT sum(amount) FROM events), 0) <> 340.00
       OR coalesce((SELECT sum(received_amount) FROM events), 0) <> 110.00 THEN
        RAISE EXCEPTION 'Divergencia financeira';
    END IF;
    IF EXISTS (SELECT 1 FROM calendars c LEFT JOIN users u ON u.id = c.owner_user_id WHERE u.id IS NULL)
       OR EXISTS (SELECT 1 FROM calendar_members m LEFT JOIN calendars c ON c.id = m.calendar_id LEFT JOIN users u ON u.id = m.user_id WHERE c.id IS NULL OR u.id IS NULL)
       OR EXISTS (SELECT 1 FROM events e LEFT JOIN calendars c ON c.id = e.calendar_id LEFT JOIN users u ON u.id = e.created_by_user_id WHERE c.id IS NULL OR u.id IS NULL)
       OR EXISTS (SELECT 1 FROM audit_logs a LEFT JOIN users u ON u.id = a.performed_by_user_id WHERE u.id IS NULL) THEN
        RAISE EXCEPTION 'Referencias orfas';
    END IF;
END $$;

COMMIT;

SELECT 'users' AS table_name, count(*) AS rows FROM users
UNION ALL SELECT 'calendars', count(*) FROM calendars
UNION ALL SELECT 'calendar_members', count(*) FROM calendar_members
UNION ALL SELECT 'events', count(*) FROM events
UNION ALL SELECT 'audit_logs', count(*) FROM audit_logs;
SELECT sum(amount) AS amount_sum, sum(received_amount) AS received_sum FROM events;
