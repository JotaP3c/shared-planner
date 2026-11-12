import { canRespondToApproval, hasCalendarRole } from './calendar-permissions';
import { financeAuthorizedCalendars } from './finance-access';
import { CalendarResponse, EventResponse, UserResponse } from '../models/shared-planner.models';

describe('combined calendar permissions and participant decisions', () => {
  const calendar: CalendarResponse = { id: 'malu', name: 'Malu', ownerEmail: 'malu@example.test', memberRole: 'EDITOR', memberRoles: ['EDITOR', 'FINANCE'], canCreateEvents: true };
  const user = { id: 'joao', email: 'joao@example.test', role: 'USER' } as UserResponse;
  it('lets EDITOR + FINANCE view finance without granting calendar administration', () => {
    expect(hasCalendarRole(calendar, 'EDITOR')).toBe(true);
    expect(hasCalendarRole(calendar, 'FINANCE')).toBe(true);
    expect(hasCalendarRole(calendar, 'ADMIN')).toBe(false);
    expect(financeAuthorizedCalendars(user, [calendar, { ...calendar, id: 'private', memberRole: null, memberRoles: [] }]).map(item => item.id)).toEqual(['malu']);
  });
  it('does not give global FINANCE access to an unrelated calendar', () => {
    expect(financeAuthorizedCalendars({ ...user, role: 'FINANCE' }, [{ ...calendar, memberRole: null, memberRoles: [] }])).toEqual([]);
  });
  it('allows only designated participants that have not answered, for every event type', () => {
    const event = { eventType: 'CLIENT', status: 'PENDING_APPROVAL', approvals: [
      { userEmail: 'joao@example.test', status: 'APPROVED' }, { userEmail: 'malu@example.test', status: 'PENDING' },
    ] } as EventResponse;
    expect(canRespondToApproval(event, 'joao@example.test')).toBe(false);
    expect(canRespondToApproval(event, 'MALU@example.test')).toBe(true);
    expect(canRespondToApproval(event, 'outsider@example.test')).toBe(false);
    expect(canRespondToApproval({ ...event, status: 'REJECTED' }, 'malu@example.test')).toBe(false);
  });
});
