UPDATE calendar_members SET member_role = 'ADMIN' WHERE member_role = 'OWNER';
UPDATE calendar_members SET member_role = 'VIEWER' WHERE member_role = 'MEMBER';
ALTER TABLE calendar_members ALTER COLUMN member_role SET DEFAULT 'VIEWER';
