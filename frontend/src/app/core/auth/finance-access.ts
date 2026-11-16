import { CalendarResponse, UserResponse } from '../models/shared-planner.models';
import { canCalendarPermission } from './calendar-permissions';

/**
 * Grants financeiros efetivos já combinam perfis globais, vínculo e contexto no backend.
 * Nomes de papéis não ampliam esse resultado. A API continua sendo a autoridade (403).
 */
export function financeAuthorizedCalendars(
  user: UserResponse | null,
  calendars: readonly CalendarResponse[],
): CalendarResponse[] {
  if (!user) {
    return [];
  }

  return calendars.filter(calendar => canCalendarPermission(calendar, 'FINANCE_VIEW'));
}
