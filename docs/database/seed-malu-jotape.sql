USE shared_planner_dev;

-- ============================================================
-- Cleanup (idempotent — safe to re-run)
-- ============================================================

DELETE FROM dbo.calendar_members
WHERE calendar_id IN (
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    'ffffffff-ffff-ffff-ffff-ffffffffffff'
);

DELETE FROM dbo.calendars
WHERE id IN (
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    'ffffffff-ffff-ffff-ffff-ffffffffffff'
);

DELETE FROM dbo.users
WHERE id IN (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'cccccccc-cccc-cccc-cccc-cccccccccccc'
);

-- ============================================================
-- Users
-- Password hash below = bcrypt("admin"), same as seed-dev-data
-- role = USER (not system ADMIN — calendar ADMIN only via member_role)
-- ============================================================

INSERT INTO dbo.users (id, full_name, email, password_hash, role, active, created_at)
VALUES
    (
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        'Malu',
        'malu@gmail.com',
        '$2a$10$DMO6/G6HOHknCpL5fS5w/eg9eS6g.fAhFrtoVrbsutUX3XsjzlH9i',
        'USER',
        1,
        SYSUTCDATETIME()
    ),
    (
        'cccccccc-cccc-cccc-cccc-cccccccccccc',
        'Jotape',
        'jotape@gmail.com',
        '$2a$10$DMO6/G6HOHknCpL5fS5w/eg9eS6g.fAhFrtoVrbsutUX3XsjzlH9i',
        'USER',
        1,
        SYSUTCDATETIME()
    );

-- ============================================================
-- Calendars
-- ============================================================

INSERT INTO dbo.calendars (id, name, owner_user_id, created_at)
VALUES
    (
        'dddddddd-dddd-dddd-dddd-dddddddddddd',
        'Agenda - Malu',
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',   -- owner: malu
        SYSUTCDATETIME()
    ),
    (
        'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
        'Agenda - Jotape',
        'cccccccc-cccc-cccc-cccc-cccccccccccc',   -- owner: jotape
        SYSUTCDATETIME()
    ),
    (
        'ffffffff-ffff-ffff-ffff-ffffffffffff',
        'Agenda João/Malu',
        'cccccccc-cccc-cccc-cccc-cccccccccccc',   -- owner técnico: jotape
        SYSUTCDATETIME()
    );

-- ============================================================
-- Calendar members
-- Personal calendars:
--   owner = ADMIN
--   other user = VIEWER
-- Shared calendar:
--   owner = ADMIN
--   invited user = EDITOR
-- ============================================================

INSERT INTO dbo.calendar_members (id, calendar_id, user_id, member_role, created_at)
VALUES
    -- Agenda - Malu
    (NEWID(), 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'ADMIN',  SYSUTCDATETIME()),
    (NEWID(), 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'VIEWER', SYSUTCDATETIME()),

    -- Agenda - Jotape
    (NEWID(), 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'ADMIN',  SYSUTCDATETIME()),
    (NEWID(), 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'VIEWER', SYSUTCDATETIME()),

    -- Agenda João/Malu
    (NEWID(), 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'ADMIN',  SYSUTCDATETIME()),
    (NEWID(), 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'EDITOR', SYSUTCDATETIME());

-- ============================================================
-- Summary
-- ============================================================
SELECT
    'Seed malu-jotape completed'          AS result,
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' AS malu_id,
    'cccccccc-cccc-cccc-cccc-cccccccccccc' AS jotape_id,
    'dddddddd-dddd-dddd-dddd-dddddddddddd' AS agenda_malu_id,
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee' AS agenda_jotape_id,
    'ffffffff-ffff-ffff-ffff-ffffffffffff' AS agenda_joao_malu_id,
    'malu@gmail.com / admin'               AS malu_credentials,
    'jotape@gmail.com / admin'             AS jotape_credentials;
