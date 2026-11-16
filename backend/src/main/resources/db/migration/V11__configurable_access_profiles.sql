-- Additive RBAC catalog. Legacy enums remain compatibility mappings, not a second authorization path.
CREATE TABLE access_profiles (
    id UUID PRIMARY KEY,
    code VARCHAR(80) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    scope VARCHAR(20) NOT NULL CHECK (scope IN ('GLOBAL','CALENDAR')),
    active BOOLEAN NOT NULL,
    built_in BOOLEAN NOT NULL
);
CREATE TABLE access_profile_permissions (
    profile_id UUID NOT NULL REFERENCES access_profiles(id),
    permission VARCHAR(50) NOT NULL,
    PRIMARY KEY (profile_id,permission)
);
CREATE TABLE access_assignments (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    calendar_id UUID REFERENCES calendars(id),
    context_key VARCHAR(40) NOT NULL,
    UNIQUE (user_id,context_key),
    CHECK ((calendar_id IS NULL AND context_key='SYSTEM') OR
           (calendar_id IS NOT NULL AND context_key=CAST(calendar_id AS VARCHAR(40))))
);
CREATE TABLE access_assignment_profiles (
    assignment_id UUID NOT NULL REFERENCES access_assignments(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES access_profiles(id),
    PRIMARY KEY (assignment_id,profile_id)
);
CREATE INDEX idx_access_assignments_calendar ON access_assignments(calendar_id);

INSERT INTO access_profiles(id,code,name,scope,active,built_in) VALUES
('00000000-0000-0000-0000-000000001101','SYSTEM_ADMIN','Administrador do sistema','GLOBAL',TRUE,TRUE),
('00000000-0000-0000-0000-000000001102','SYSTEM_FINANCE','Financeiro do sistema','GLOBAL',TRUE,TRUE),
('00000000-0000-0000-0000-000000001103','USER','Usuário','GLOBAL',TRUE,TRUE),
('00000000-0000-0000-0000-000000001104','CALENDAR_ADMIN','Administrador de calendário','CALENDAR',TRUE,TRUE),
('00000000-0000-0000-0000-000000001105','CALENDAR_EDITOR','Editor de calendário','CALENDAR',TRUE,TRUE),
('00000000-0000-0000-0000-000000001106','CALENDAR_VIEWER','Visualizador de calendário','CALENDAR',TRUE,TRUE),
('00000000-0000-0000-0000-000000001107','CALENDAR_FINANCE','Financeiro de calendário','CALENDAR',TRUE,TRUE);

INSERT INTO access_profile_permissions(profile_id,permission)
SELECT p.id,v.permission FROM access_profiles p CROSS JOIN (VALUES
 ('CALENDAR_VIEW'),('CALENDAR_CREATE'),('EVENT_CREATE'),('EVENT_EDIT'),('EVENT_EDIT_ALL'),
 ('EVENT_CANCEL'),('EVENT_APPROVE'),('FINANCE_VIEW'),('FINANCE_VIEW_OWN'),('FINANCE_MANAGE'),
 ('FINANCE_MANAGE_OWN'),('FINANCE_EXPORT'),('FINANCE_MEMBER_CALENDARS'),('MEMBERS_VIEW'),
 ('MEMBERS_MANAGE'),('USERS_VIEW'),('USERS_MANAGE'),('ROLES_MANAGE'),('AUDIT_VIEW'),
 ('AUDIT_VIEW_ALL'),('CALENDAR_IMPORT'),('SETTINGS_VIEW')
) AS v(permission)
WHERE p.code='SYSTEM_ADMIN'
 OR (p.code IN ('SYSTEM_FINANCE','USER') AND v.permission NOT IN
     ('USERS_VIEW','USERS_MANAGE','ROLES_MANAGE','AUDIT_VIEW_ALL','FINANCE_MEMBER_CALENDARS'))
 OR (p.code='SYSTEM_FINANCE' AND v.permission='FINANCE_MEMBER_CALENDARS')
 OR (p.code='CALENDAR_ADMIN' AND v.permission NOT IN
     ('CALENDAR_CREATE','USERS_VIEW','USERS_MANAGE','ROLES_MANAGE','AUDIT_VIEW_ALL','FINANCE_MEMBER_CALENDARS','SETTINGS_VIEW'))
 OR (p.code='CALENDAR_EDITOR' AND v.permission IN
     ('CALENDAR_VIEW','MEMBERS_VIEW','EVENT_APPROVE','EVENT_CREATE','EVENT_EDIT','EVENT_CANCEL','FINANCE_VIEW_OWN','FINANCE_MANAGE_OWN','CALENDAR_IMPORT'))
 OR (p.code='CALENDAR_VIEWER' AND v.permission IN ('CALENDAR_VIEW','MEMBERS_VIEW','EVENT_APPROVE'))
 OR (p.code='CALENDAR_FINANCE' AND v.permission IN ('CALENDAR_VIEW','MEMBERS_VIEW','EVENT_APPROVE','FINANCE_VIEW','FINANCE_EXPORT'));
