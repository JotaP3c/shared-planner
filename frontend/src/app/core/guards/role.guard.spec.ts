import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { Observable, firstValueFrom, isObservable, of } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { UserRole } from '../models/shared-planner.models';
import { auditAccessGuard, systemAdminGuard } from './role.guard';

describe('role guards (BLG-FE-002)', () => {
  let http: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  function signIn(role: UserRole): void {
    TestBed.inject(AuthService).currentUser.set({
      id: 'u', fullName: 'U', email: 'u@example.com', role, active: true, createdAt: '', updatedAt: '',
    });
  }

  function run(guard: typeof systemAdminGuard): Observable<boolean | UrlTree> {
    const result = TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));
    return isObservable(result) ? result as Observable<boolean | UrlTree> : of(result as boolean | UrlTree);
  }

  const toCalendar = (result: boolean | UrlTree) =>
    result instanceof UrlTree && router.serializeUrl(result) === '/calendar';

  it('lets only a global ADMIN open /admin/users', async () => {
    signIn('ADMIN');
    expect(await firstValueFrom(run(systemAdminGuard))).toBe(true);

    signIn('USER');
    expect(toCalendar(await firstValueFrom(run(systemAdminGuard)))).toBe(true);

    signIn('FINANCE');
    expect(toCalendar(await firstValueFrom(run(systemAdminGuard)))).toBe(true);
  });

  it('lets a calendar ADMIN open /audit and redirects other members', async () => {
    signIn('USER');
    const allowed = firstValueFrom(run(auditAccessGuard));
    http.expectOne('/api/calendars').flush([
      { id: 'c', name: 'c', ownerEmail: 'u@example.com', memberRole: 'ADMIN', canCreateEvents: true },
    ]);
    expect(await allowed).toBe(true);

    const denied = firstValueFrom(run(auditAccessGuard));
    http.expectOne('/api/calendars').flush([
      { id: 'c', name: 'c', ownerEmail: 'o@example.com', memberRole: 'EDITOR', canCreateEvents: true },
    ]);
    expect(toCalendar(await denied)).toBe(true);
  });

  it('redirects /audit when the calendar capability cannot be resolved', async () => {
    signIn('USER');
    const result = firstValueFrom(run(auditAccessGuard));
    http.expectOne('/api/calendars').flush('x', { status: 500, statusText: 'Server Error' });
    expect(toCalendar(await result)).toBe(true);
  });

  it('allows a global ADMIN into /audit without extra requests', async () => {
    signIn('ADMIN');
    expect(await firstValueFrom(run(auditAccessGuard))).toBe(true);
    http.verify();
  });
});
