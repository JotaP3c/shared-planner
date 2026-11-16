import { CalendarMemberRole, CalendarResponse, EventResponse, UserResponse } from '../models/shared-planner.models';
import { Permission } from '../models/access.models';

/** Backend effective grants are authoritative; unresolved or empty grants deny access. */
export function canCalendarPermission(calendar: CalendarResponse | null | undefined, permission: Permission): boolean {
  return calendar?.permissions?.includes(permission) === true;
}

export function canGlobalPermission(user: UserResponse | null | undefined, permission: Permission): boolean {
  return user?.permissions?.includes(permission) === true;
}

/** Legacy roles for display; operation authorization uses effective permissions above. */
export function calendarRoles(calendar: CalendarResponse): CalendarMemberRole[] {
  return calendar.memberRoles ?? (calendar.memberRole ? [calendar.memberRole] : []);
}

export function hasCalendarRole(calendar: CalendarResponse, role: CalendarMemberRole): boolean {
  return calendarRoles(calendar).includes(role);
}

export function canRespondToApproval(event: EventResponse, email: string | null | undefined): boolean {
  if (event.status !== 'PENDING_APPROVAL' || !email) return false;
  if (event.approvals?.length) {
    return event.approvals.some(approval => approval.status === 'PENDING'
      && approval.userEmail.toLowerCase() === email.toLowerCase());
  }
  return event.approvalRequestedFromEmail?.toLowerCase() === email.toLowerCase();
}
