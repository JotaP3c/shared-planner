import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { Observable, firstValueFrom, isObservable, of } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { UserRole } from '../models/shared-planner.models';
import { Permission } from '../models/access.models';
import { auditAccessGuard, systemAdminGuard } from './role.guard';

describe('role guards (BLG-FE-002)', () => {
  let http: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    localStorage.setItem('sharedPlanner.token', 'test-session');
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => { http.verify(); localStorage.clear(); });

  function signIn(role: UserRole, permissions: Permission[] = []): void {
    TestBed.inject(AuthService).currentUser.set({
      id: 'u', fullName: 'U', email: 'u@example.com', role, permissions, active: true, createdAt: '', updatedAt: '',
    });
  }

  function run(guard: typeof systemAdminGuard): Observable<boolean | UrlTree> {
    const result = TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));
    return isObservable(result) ? result as Observable<boolean | UrlTree> : of(result as boolean | UrlTree);
  }

  function refreshed(guard: typeof systemAdminGuard, response: object | null = TestBed.inject(AuthService).currentUser()) {
    const pending = firstValueFrom(run(guard));
    http.expectOne('/api/auth/me').flush(response);
    return pending;
  }

  const toDenied = (result: boolean | UrlTree) =>
    result instanceof UrlTree && router.serializeUrl(result) === '/access-denied';

  it('requires an explicit global USERS_VIEW grant for direct /admin/users access', async () => {
    signIn('USER', ['USERS_VIEW']);
    expect(await refreshed(systemAdminGuard)).toBe(true);

    signIn('ADMIN');
    expect(toDenied(await refreshed(systemAdminGuard))).toBe(true);

    signIn('FINANCE');
    expect(toDenied(await refreshed(systemAdminGuard))).toBe(true);
  });

  it('checks contextual AUDIT_VIEW independently of role names', async () => {
    signIn('USER');
    const allowed = refreshed(auditAccessGuard);
    http.expectOne('/api/calendars').flush([
      { id: 'c', name: 'c', ownerEmail: 'u@example.com', memberRole: 'EDITOR', canCreateEvents: true, permissions: ['AUDIT_VIEW'] },
    ]);
    expect(await allowed).toBe(true);

    const denied = refreshed(auditAccessGuard);
    http.expectOne('/api/calendars').flush([
      { id: 'c', name: 'c', ownerEmail: 'o@example.com', memberRole: 'ADMIN', canCreateEvents: true, permissions: [] },
    ]);
    expect(toDenied(await denied)).toBe(true);
  });

  it('redirects /audit when the calendar capability cannot be resolved', async () => {
    signIn('USER');
    const result = refreshed(auditAccessGuard);
    http.expectOne('/api/calendars').flush('x', { status: 500, statusText: 'Server Error' });
    expect(toDenied(await result)).toBe(true);
  });

  it('allows a global AUDIT_VIEW_ALL grant without resolving a calendar', async () => {
    signIn('USER', ['AUDIT_VIEW_ALL']);
    expect(await refreshed(auditAccessGuard)).toBe(true);
    http.verify();
  });

  it('refreshes global permissions before opening a direct URL with a still-valid token', async () => {
    signIn('ADMIN', ['USERS_VIEW']);
    const result = refreshed(systemAdminGuard, { ...TestBed.inject(AuthService).currentUser(), permissions: [] });
    expect(toDenied(await result)).toBe(true);
    expect(TestBed.inject(AuthService).getToken()).toBe('test-session');
  });

  it('denies a cached global grant when the refresh cannot be resolved', async () => {
    signIn('ADMIN', ['USERS_VIEW']);
    const pending = firstValueFrom(run(systemAdminGuard));
    http.expectOne('/api/auth/me').flush({ detail: 'Unavailable' }, { status: 500, statusText: 'Server Error' });
    expect(toDenied(await pending)).toBe(true);
    expect(TestBed.inject(AuthService).currentUser()?.permissions).toEqual([]);
  });
});
