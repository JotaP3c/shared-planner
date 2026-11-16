import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { Observable, catchError, map, of, switchMap } from 'rxjs';

import { CalendarService } from '../api/calendar.service';
import { AuthService } from '../auth/auth.service';
import { UserResponse } from '../models/shared-planner.models';
import { Permission } from '../models/access.models';
import { canCalendarPermission, canGlobalPermission } from '../auth/calendar-permissions';

/**
 * Guards de UX por permissões efetivas. O backend continua sendo a autoridade:
 * estes guards só evitam abrir telas que retornariam 403.
 */

/** /admin/users: exige o grant global USERS_VIEW. */
export const systemAdminGuard = permissionGuard('USERS_VIEW');

/** /audit: AUDIT_VIEW contextual ou AUDIT_VIEW_ALL global. */
export const auditAccessGuard = permissionGuard('AUDIT_VIEW', true);

/** Effective grants from the backend decide UX access; missing grants deny. */
export function permissionGuard(permission: Permission, contextual = false): CanActivateFn {
  return () => {
    const router = inject(Router);
    const calendars = inject(CalendarService);
    return resolveCurrentUser(inject(AuthService)).pipe(
      switchMap((user): Observable<boolean | UrlTree> => {
        if (!user) return of(denied(router));
        if (!contextual) return of(canGlobalPermission(user, permission) || denied(router));
        if (permission === 'AUDIT_VIEW' && canGlobalPermission(user, 'AUDIT_VIEW_ALL')) return of(true);
        return calendars.list().pipe(
          map(items => items.some(calendar => canCalendarPermission(calendar, permission)) || denied(router)),
          catchError(() => of(denied(router))),
        );
      }),
    );
  };
}

function resolveCurrentUser(authService: AuthService): Observable<UserResponse | null> {
  // A cached global grant must not survive a revocation while the token remains valid.
  return authService.loadCurrentUser().pipe(map(response => response ? authService.currentUser() : null));
}

function denied(router: Router): UrlTree {
  return router.createUrlTree(['/access-denied']);
}
