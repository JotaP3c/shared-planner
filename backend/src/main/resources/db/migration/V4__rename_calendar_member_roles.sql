UPDATE dbo.calendar_members
SET member_role = 'ADMIN'
WHERE member_role = 'OWNER';

UPDATE dbo.calendar_members
SET member_role = 'VIEWER'
WHERE member_role = 'MEMBER';

DECLARE @constraintName SYSNAME;
DECLARE @sql NVARCHAR(MAX);

SELECT @constraintName = dc.name
FROM sys.default_constraints dc
JOIN sys.columns c
    ON c.object_id = dc.parent_object_id
   AND c.column_id = dc.parent_column_id
WHERE dc.parent_object_id = OBJECT_ID('dbo.calendar_members')
  AND c.name = 'member_role';

IF @constraintName IS NOT NULL
BEGIN
    SET @sql = N'ALTER TABLE dbo.calendar_members DROP CONSTRAINT ' + QUOTENAME(@constraintName);
    EXEC sp_executesql @sql;
END;

ALTER TABLE dbo.calendar_members
ADD CONSTRAINT df_calendar_members_member_role DEFAULT ('VIEWER') FOR member_role;
