export type Permission =
  | 'CALENDAR_VIEW' | 'CALENDAR_CREATE' | 'EVENT_CREATE' | 'EVENT_EDIT' | 'EVENT_EDIT_ALL'
  | 'EVENT_CANCEL' | 'EVENT_APPROVE' | 'FINANCE_VIEW' | 'FINANCE_VIEW_OWN'
  | 'FINANCE_MANAGE' | 'FINANCE_MANAGE_OWN' | 'FINANCE_EXPORT' | 'FINANCE_MEMBER_CALENDARS'
  | 'MEMBERS_VIEW' | 'MEMBERS_MANAGE' | 'USERS_VIEW' | 'USERS_MANAGE' | 'ROLES_MANAGE'
  | 'AUDIT_VIEW' | 'AUDIT_VIEW_ALL' | 'CALENDAR_IMPORT' | 'SETTINGS_VIEW';

export interface PermissionDefinition { code: Permission; module: string; label: string; globalOnly: boolean; }
export interface AccessProfile {
  id: string; code: string; name: string; scope: 'GLOBAL' | 'CALENDAR';
  active: boolean; builtIn: boolean; permissions: Permission[];
}
export interface ProfileRequest { name: string; scope?: 'GLOBAL' | 'CALENDAR'; active: boolean; permissions: Permission[]; }
export interface ProfileAssignment {
  userId: string; calendarId: string | null; profileIds: string[]; explicit?: boolean;
}
export interface EffectiveAccess {
  userId: string; profileIds: string[]; globalPermissions: Permission[];
  calendars: { calendarId: string; profileIds: string[]; permissions: Permission[] }[];
}
