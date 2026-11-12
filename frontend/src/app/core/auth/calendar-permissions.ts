import { CalendarMemberRole, CalendarResponse, EventResponse } from '../models/shared-planner.models';

/** Roles array is authoritative; singular role keeps older API/test fixtures compatible. */
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
