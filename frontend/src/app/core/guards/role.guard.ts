import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { Observable, catchError, map, of, switchMap } from 'rxjs';

import { CalendarService } from '../api/calendar.service';
import { AuthService } from '../auth/auth.service';
import { UserResponse } from '../models/shared-planner.models';

/**
 * Guards de UX por papel (BLG-FE-002). O backend continua sendo a autoridade:
 * estes guards só evitam abrir telas que retornariam 403.
 */

/** /admin/users: somente ADMIN global (BR-USER-001). */
export const systemAdminGuard: CanActivateFn = () => {
  const router = inject(Router);

  return resolveCurrentUser(inject(AuthService)).pipe(
    map(user => user?.role === 'ADMIN' ? true : denied(router)),
  );
};

/** /audit: ADMIN global ou ADMIN de pelo menos um calendário (BR-AUDIT-002). */
export const auditAccessGuard: CanActivateFn = () => {
  const router = inject(Router);
  const calendarService = inject(CalendarService);

  return resolveCurrentUser(inject(AuthService)).pipe(
    switchMap((user): Observable<boolean | UrlTree> => {
      if (!user) {
        return of(denied(router));
      }

      if (user.role === 'ADMIN') {
        return of(true);
      }

      return calendarService.list().pipe(
        map(calendars => calendars.some(calendar => calendar.memberRole === 'ADMIN')
          ? true
          : denied(router)),
        catchError(() => of(denied(router))),
      );
    }),
  );
};

function resolveCurrentUser(authService: AuthService): Observable<UserResponse | null> {
  const user = authService.currentUser();
  if (user) {
    return of(user);
  }

  // loadCurrentUser preenche o signal; o guard lê o valor normalizado dele.
  return authService.loadCurrentUser().pipe(map(() => authService.currentUser()));
}

function denied(router: Router): UrlTree {
  return router.createUrlTree(['/calendar']);
}
