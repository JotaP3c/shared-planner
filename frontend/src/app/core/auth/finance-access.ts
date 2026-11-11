import { CalendarResponse, UserResponse } from '../models/shared-planner.models';

/**
 * Calendários em que o usuário tem capacidade financeira (BR-FIN-003), espelhando o backend:
 * ADMIN global vê todos; FINANCE global precisa ser membro; demais precisam de papel
 * ADMIN ou FINANCE no calendário. A API continua sendo a autoridade (403).
 */
export function financeAuthorizedCalendars(
  user: UserResponse | null,
  calendars: readonly CalendarResponse[],
): CalendarResponse[] {
  if (!user) {
    return [];
  }

  if (user.role === 'ADMIN') {
    return [...calendars];
  }

  if (user.role === 'FINANCE') {
    return calendars.filter(calendar => calendar.memberRole !== null);
  }

  return calendars.filter(calendar => calendar.memberRole === 'ADMIN' || calendar.memberRole === 'FINANCE');
}
