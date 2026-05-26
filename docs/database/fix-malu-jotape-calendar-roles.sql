USE shared_planner_dev;

-- Fix calendar roles without deleting users, calendars, or events.
-- Expected business rule:
-- - Jotape can only view Agenda - Malu.
-- - Malu can only view Agenda - Jotape.
-- - Both can work in the shared calendar.
DECLARE @malu_calendar_id UNIQUEIDENTIFIER = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
DECLARE @jotape_calendar_id UNIQUEIDENTIFIER = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
DECLARE @shared_calendar_id UNIQUEIDENTIFIER = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

UPDATE cm
SET member_role = 'VIEWER'
FROM dbo.calendar_members cm
JOIN dbo.users u ON u.id = cm.user_id
WHERE cm.calendar_id = @malu_calendar_id
  AND u.email = 'jotape@gmail.com';

UPDATE cm
SET member_role = 'VIEWER'
FROM dbo.calendar_members cm
JOIN dbo.users u ON u.id = cm.user_id
WHERE cm.calendar_id = @jotape_calendar_id
  AND u.email = 'malu@gmail.com';

UPDATE cm
SET member_role = 'ADMIN'
FROM dbo.calendar_members cm
JOIN dbo.users u ON u.id = cm.user_id
WHERE cm.calendar_id = @shared_calendar_id
  AND u.email = 'jotape@gmail.com';

UPDATE cm
SET member_role = 'EDITOR'
FROM dbo.calendar_members cm
JOIN dbo.users u ON u.id = cm.user_id
WHERE cm.calendar_id = @shared_calendar_id
  AND u.email = 'malu@gmail.com';

SELECT
    c.name AS calendar_name,
    u.email AS user_email,
    cm.member_role
FROM dbo.calendar_members cm
JOIN dbo.calendars c ON c.id = cm.calendar_id
JOIN dbo.users u ON u.id = cm.user_id
WHERE u.email IN ('malu@gmail.com', 'jotape@gmail.com')
ORDER BY c.name, u.email;
