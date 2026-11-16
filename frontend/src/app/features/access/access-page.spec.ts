import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AccessPage } from './access-page';
import { AuthService } from '../../core/auth/auth.service';
import { AccessProfile } from '../../core/models/access.models';

describe('configurable access profiles', () => {
  let http: HttpTestingController;
  const profile: AccessProfile = { id: 'p', code: 'CUSTOM_VIEW', name: 'Consulta', scope: 'CALENDAR', active: true, builtIn: false, permissions: ['CALENDAR_VIEW'] };
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AccessPage], providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).currentUser.set({ id: 'admin', email: 'admin@example.invalid', fullName: 'Admin', role: 'ADMIN', permissions: ['ROLES_MANAGE'], active: true, createdAt: '', updatedAt: '' });
  });
  function create() {
    const fixture = TestBed.createComponent(AccessPage); fixture.detectChanges();
    http.expectOne('/api/access/permissions').flush([
      { code: 'CALENDAR_VIEW', label: 'Ver calendário', module: 'Calendário', globalOnly: false },
      { code: 'ROLES_MANAGE', label: 'Gerenciar perfis globais', module: 'Administração', globalOnly: true },
    ]);
    http.expectOne('/api/access/profiles').flush([profile]);
    http.expectOne('/api/access/users').flush([{ id: 'u', email: 'u@example.invalid', fullName: 'Pessoa' }]);
    http.expectOne('/api/calendars').flush([{ id: 'c', name: 'Agenda', permissions: ['MEMBERS_MANAGE'] }]);
    fixture.detectChanges(); return fixture;
  }
  afterEach(() => http.verify({ ignoreCancelled: true }));
  it('denies missing grants even when the legacy global role is ADMIN', () => {
    TestBed.inject(AuthService).currentUser.update(user => ({ ...user!, permissions: [] }));
    const fixture = TestBed.createComponent(AccessPage); fixture.detectChanges();
    expect(fixture.componentInstance.allowed()).toBe(false); http.expectNone('/api/access/profiles');
    fixture.componentInstance.name.set('Proibido'); fixture.componentInstance.saveProfile(); http.expectNone(req => req.method === 'POST');
    expect(fixture.nativeElement.textContent).toContain('Você não tem permissão');
  });
  it('edits explicit grants and does not expose global-only grants in a calendar profile', () => {
    const fixture = create(), page = fixture.componentInstance;
    page.edit(profile); fixture.detectChanges();
    expect(page.scopeCatalog().map(p => p.code)).toEqual(['CALENDAR_VIEW']);
    page.togglePermission('CALENDAR_VIEW', false); page.saveProfile();
    const request = http.expectOne('/api/access/profiles/p');
    expect(request.request.method).toBe('PUT'); expect(request.request.body.permissions).toEqual([]);
    request.flush({ ...profile, permissions: [] });
    http.expectOne('/api/access/permissions').flush([]); http.expectOne('/api/access/profiles').flush([{ ...profile, permissions: [] }]);
    http.expectOne('/api/access/users').flush([]); http.expectOne('/api/calendars').flush([]);
    expect(page.success()).toContain('Perfil salvo');
  });
  it('loads assignments per calendar and submits an explicit empty list as revocation', () => {
    const fixture = create(), page = fixture.componentInstance;
    page.selectedCalendarId.set('c'); page.selectUser('u');
    http.expectOne('/api/access/assignments?userId=u&calendarId=c').flush({ userId: 'u', calendarId: 'c', profileIds: ['p'], explicit: true });
    http.expectOne('/api/access/effective?userId=u&calendarId=c').flush({ userId: 'u', profileIds: [], globalPermissions: ['CALENDAR_VIEW'], calendars: [{ calendarId: 'c', profileIds: ['p'], permissions: ['CALENDAR_VIEW'] }] });
    expect(page.effectiveGrants()).toEqual(['CALENDAR_VIEW']); page.toggleAssignment('p', false); page.saveAssignment();
    const request = http.expectOne('/api/access/assignments');
    expect(request.request.body).toEqual({ userId: 'u', calendarId: 'c', profileIds: [] });
    request.flush({ detail: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });
    expect(page.error()).toContain('Você não tem permissão'); expect(page.savingAssignment()).toBe(false);
  });
  it('cancels stale effective results when a different user is selected', () => {
    const fixture = create(), page = fixture.componentInstance;
    page.selectUser('first');
    const old = http.expectOne('/api/access/assignments?userId=first');
    http.expectOne('/api/access/effective?userId=first');
    page.selectUser('second'); expect(old.cancelled).toBe(true); expect(page.effectiveGrants()).toEqual([]);
    http.expectOne('/api/access/assignments?userId=second').flush({ userId: 'second', calendarId: null, profileIds: [], explicit: true });
    http.expectOne('/api/access/effective?userId=second').flush({ userId: 'second', profileIds: [], globalPermissions: [], calendars: [] });
    expect(page.effective()?.userId).toBe('second'); expect(page.effectiveGrants()).toEqual([]);
  });

  it('lets an inactive assigned profile be removed and replaced without reassigning the inactive profile', () => {
    localStorage.removeItem('sharedPlanner.token');
    const fixture = create(), page = fixture.componentInstance;
    page.profiles.set([{ ...profile, active: false }, { ...profile, id: 'active', name: 'Ativo' }]);
    page.selectedCalendarId.set('c'); page.selectUser('u');
    http.expectOne('/api/access/assignments?userId=u&calendarId=c').flush({ userId: 'u', calendarId: 'c', profileIds: ['p'], explicit: true });
    http.expectOne('/api/access/effective?userId=u&calendarId=c').flush({ userId: 'u', profileIds: [], globalPermissions: ['CALENDAR_VIEW'], calendars: [{ calendarId: 'c', profileIds: ['p'], permissions: [] }] });
    fixture.detectChanges();
    const inputs = fixture.nativeElement.querySelectorAll('.assignment-options input') as NodeListOf<HTMLInputElement>;
    expect(inputs[0].checked).toBe(true); expect(inputs[0].disabled).toBe(false);
    inputs[0].click(); fixture.detectChanges();
    expect(inputs[0].checked).toBe(false); expect(inputs[0].disabled).toBe(true);
    page.toggleAssignment('p', true);
    expect(page.assignmentIds()).not.toContain('p');
    inputs[1].click(); page.saveAssignment();
    const save = http.expectOne('/api/access/assignments');
    expect(save.request.method).toBe('PUT');
    expect(save.request.body).toEqual({ userId: 'u', calendarId: 'c', profileIds: ['active'] });
    save.flush({ userId: 'u', calendarId: 'c', profileIds: ['active'], explicit: true });
    http.expectOne('/api/access/assignments?userId=u&calendarId=c').flush({ userId: 'u', calendarId: 'c', profileIds: ['active'], explicit: true });
    http.expectOne('/api/access/effective?userId=u&calendarId=c').flush({ userId: 'u', profileIds: [], globalPermissions: ['CALENDAR_VIEW'], calendars: [{ calendarId: 'c', profileIds: ['active'], permissions: ['CALENDAR_VIEW'] }] });
    expect(page.success()).toBe('Associação salva.');
  });
});
