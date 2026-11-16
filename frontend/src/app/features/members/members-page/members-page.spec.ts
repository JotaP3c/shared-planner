import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { MembersPage } from './members-page';
import { CalendarMemberResponse, CalendarResponse } from '../../../core/models/shared-planner.models';
import { AuthService } from '../../../core/auth/auth.service';

describe('MembersPage', () => {
  let component: MembersPage;
  let fixture: ComponentFixture<MembersPage>;

  const calendar = (id: string): CalendarResponse => ({ id, name: id, ownerEmail: 'owner@example.com', memberRole: 'ADMIN', canCreateEvents: true, permissions: ['CALENDAR_VIEW', 'MEMBERS_VIEW', 'MEMBERS_MANAGE'] });
  const member = (id: string, calendarId: string): CalendarMemberResponse => ({
    id, calendarId, userEmail: `${id}@example.com`, userFullName: id, role: 'VIEWER', createdAt: '2026-08-21T10:00:00',
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MembersPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(MembersPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load calendars and their members', () => {
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/calendars').flush([{ id: 'calendar', name: 'Agenda', ownerEmail: 'owner@example.com', memberRole: 'VIEWER', canCreateEvents: false, permissions: ['CALENDAR_VIEW', 'MEMBERS_VIEW'] }]);
    http.expectOne('/api/calendars/calendar/members').flush([{ id: 'member', calendarId: 'calendar', userEmail: 'owner@example.com', userFullName: 'Owner', role: 'ADMIN', createdAt: '2026-08-21T10:00:00' }]);
    expect(component.members()).toHaveLength(1);
    expect(component.canManage()).toBe(false);
  });

  it('keeps loading until members arrive after calendars finish (BLG-BUG-006)', () => {
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/calendars').flush([calendar('a')]);

    expect(component.isLoading()).toBe(true);

    http.expectOne('/api/calendars/a/members').flush([member('m1', 'a')]);
    expect(component.isLoading()).toBe(false);
  });

  it('never shows members from a previously selected calendar', () => {
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/calendars').flush([calendar('a'), calendar('b')]);
    const staleRequest = http.expectOne('/api/calendars/a/members');

    component.selectCalendar('b');
    expect(component.members()).toEqual([]);
    expect(staleRequest.cancelled).toBe(true);

    http.expectOne('/api/calendars/b/members').flush([member('mb', 'b')]);
    expect(component.members().map(item => item.id)).toEqual(['mb']);
    expect(component.isLoading()).toBe(false);
  });

  it('shows the role that will actually be sent (INC-03b) and explains an unknown e-mail (INC-03a)', () => {
    const http = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).currentUser.set({
      id: 'admin', fullName: 'Admin', email: 'owner@example.com', role: 'ADMIN', active: true, createdAt: '', updatedAt: '',
    });
    http.expectOne('/api/calendars').flush([calendar('a')]);
    http.expectOne('/api/calendars/a/members').flush([member('owner', 'a')]);
    fixture.detectChanges();

    const select = fixture.nativeElement.querySelector('[data-testid="member-role-select"]') as HTMLSelectElement;
    // Antes da correção a tela mostrava "Administrador" enquanto o estado enviado era VIEWER.
    expect(select.value).toBe('VIEWER');
    expect(select.selectedOptions[0].textContent).toContain('Leitor');

    component.memberEmail.set('  Fixture-member@Example.invalid ');
    component.addMember();
    const request = http.expectOne('/api/calendars/a/members');
    expect(request.request.body).toEqual({ email: 'fixture-member@example.invalid', role: 'VIEWER' });
    request.flush({ detail: 'User not found' }, { status: 404, statusText: 'Not Found' });

    expect(component.errorMessage()).toContain('Não existe conta com este e-mail');
    expect(component.errorMessage()).toContain('Administração › Usuários');
  });

  it('maps duplicate and inactive conflicts and reloads the list after success', () => {
    const http = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).currentUser.set({
      id: 'admin', fullName: 'Admin', email: 'owner@example.com', role: 'ADMIN', active: true, createdAt: '', updatedAt: '',
    });
    http.expectOne('/api/calendars').flush([calendar('a')]);
    http.expectOne('/api/calendars/a/members').flush([]);

    component.memberEmail.set('dup@example.com');
    component.addMember();
    http.expectOne(req => req.method === 'POST').flush({ detail: 'User is already a member of this calendar' },
      { status: 409, statusText: 'Conflict' });
    expect(component.errorMessage()).toContain('já é membro');

    component.memberEmail.set('off@example.com');
    component.addMember();
    http.expectOne(req => req.method === 'POST').flush({ detail: 'User is inactive' },
      { status: 409, statusText: 'Conflict' });
    expect(component.errorMessage()).toContain('inativa');

    component.memberEmail.set('ok@example.com');
    component.memberRole.set('EDITOR');
    component.addMember();
    http.expectOne(req => req.method === 'POST').flush(null, { status: 204, statusText: 'No Content' });
    http.expectOne('/api/calendars/a/members').flush([member('ok', 'a')]);
    expect(component.successMessage()).toContain('Editor');
    expect(component.members().map(item => item.id)).toEqual(['ok']);
  });

  it('rejects an invalid e-mail without calling the API', () => {
    const http = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).currentUser.set({
      id: 'admin', fullName: 'Admin', email: 'owner@example.com', role: 'ADMIN', active: true, createdAt: '', updatedAt: '',
    });
    http.expectOne('/api/calendars').flush([calendar('a')]);
    http.expectOne('/api/calendars/a/members').flush([]);

    component.memberEmail.set('sem-arroba');
    component.addMember();
    http.expectNone(req => req.method === 'POST');
    expect(component.errorMessage()).toContain('e-mail válido');
  });

  it('sends EDITOR plus FINANCE without granting calendar administration', () => {
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/calendars').flush([calendar('a')]);
    http.expectOne('/api/calendars/a/members').flush([]);
    component.memberEmail.set('editor@example.test'); component.memberRole.set('EDITOR'); component.additionalFinance.set(true);
    component.addMember();
    const request = http.expectOne(req => req.method === 'POST');
    expect(request.request.body.roles).toEqual(['EDITOR', 'FINANCE']);
    expect(request.request.body.roles).not.toContain('ADMIN');
  });

  it('clears the previous list when loading the new calendar fails', () => {
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/calendars').flush([calendar('a'), calendar('b')]);
    http.expectOne('/api/calendars/a/members').flush([member('ma', 'a')]);

    component.selectCalendar('b');
    http.expectOne('/api/calendars/b/members').flush('x', { status: 500, statusText: 'Server Error' });

    expect(component.members()).toEqual([]);
    expect(component.errorMessage()).toBeTruthy();
  });

  it('denies management from a legacy ADMIN label when effective grants are empty', () => {
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/calendars').flush([{ ...calendar('a'), permissions: ['MEMBERS_VIEW'] }]);
    http.expectOne('/api/calendars/a/members').flush([member('m', 'a')]);
    component.memberEmail.set('new@example.invalid'); component.addMember();
    expect(component.canManage()).toBe(false); http.expectNone(request => request.method === 'POST');
  });

  it('associates only contextual profiles and shows the effective permissions of that member', () => {
    const http = TestBed.inject(HttpTestingController);
    const target = { ...member('m', 'a'), userId: 'user-id' };
    http.expectOne('/api/calendars').flush([calendar('a')]);
    http.expectOne('/api/calendars/a/members').flush([target]);
    component.manageAccess(target);
    http.expectOne('/api/access/permissions').flush([{ code: 'FINANCE_VIEW', label: 'Consultar financeiro', module: 'Financeiro', globalOnly: false }]);
    http.expectOne('/api/access/profiles?calendarId=a').flush([
      { id: 'cp', name: 'Editor financeiro', scope: 'CALENDAR', active: true, permissions: ['FINANCE_VIEW'] },
      { id: 'gp', name: 'Admin global', scope: 'GLOBAL', active: true, permissions: ['ROLES_MANAGE'] },
    ]);
    http.expectOne('/api/access/assignments?userId=user-id&calendarId=a').flush({ userId: 'user-id', calendarId: 'a', profileIds: ['cp'], explicit: true });
    http.expectOne('/api/access/effective?userId=user-id&calendarId=a').flush({ userId: 'user-id', profileIds: [], globalPermissions: [], calendars: [{ calendarId: 'a', profileIds: ['cp'], permissions: ['FINANCE_VIEW'] }] });
    expect(component.accessProfiles().map(p => p.id)).toEqual(['cp']);
    expect(component.memberPermissionLabels()).toEqual(['Consultar financeiro']);
    component.toggleAccessProfile('cp', false); component.saveAccess();
    const save = http.expectOne('/api/access/assignments');
    expect(save.request.body).toEqual({ userId: 'user-id', calendarId: 'a', profileIds: [] });
    save.flush({ detail: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });
    expect(component.accessSaving()).toBe(false); expect(component.errorMessage()).toBeTruthy();
  });

  it('cancels a member access preview when the selected calendar changes', () => {
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/calendars').flush([calendar('a'), calendar('b')]);
    http.expectOne('/api/calendars/a/members').flush([]);
    component.manageAccess({ ...member('m', 'a'), userId: 'user-id' });
    const pending = http.expectOne('/api/access/effective?userId=user-id&calendarId=a');
    http.expectOne('/api/access/profiles?calendarId=a');
    http.expectOne('/api/access/permissions');
    http.expectOne('/api/access/assignments?userId=user-id&calendarId=a');
    component.selectCalendar('b');
    expect(pending.cancelled).toBe(true); expect(component.accessMember()).toBeNull();
    expect(component.memberPermissions()).toEqual([]);
    http.expectOne('/api/calendars/b/members').flush([]);
  });

  it('keeps the owner access protected in the contextual management UI', () => {
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/calendars').flush([calendar('a')]);
    http.expectOne('/api/calendars/a/members').flush([]);
    component.manageAccess({ ...member('owner', 'a'), userId: 'owner-id', userEmail: 'owner@example.com' });
    expect(component.accessMember()).toBeNull(); http.expectNone(request => request.url.startsWith('/api/access'));
  });

  it('replaces an inactive contextual profile with an active profile while preventing reassignment of the inactive profile', () => {
    const http = TestBed.inject(HttpTestingController);
    const target = { ...member('m', 'a'), userId: 'user-id' };
    const profiles = [
      { id: 'old', name: 'Antigo', scope: 'CALENDAR', active: false, permissions: ['CALENDAR_VIEW'] },
      { id: 'active', name: 'Atual', scope: 'CALENDAR', active: true, permissions: ['CALENDAR_VIEW'] },
    ];
    http.expectOne('/api/calendars').flush([calendar('a')]);
    http.expectOne('/api/calendars/a/members').flush([target]);
    component.manageAccess(target);
    const flushAccess = (profileId: string) => {
      http.expectOne('/api/access/permissions').flush([]);
      http.expectOne('/api/access/profiles?calendarId=a').flush(profiles);
      http.expectOne('/api/access/assignments?userId=user-id&calendarId=a').flush({ userId: 'user-id', calendarId: 'a', profileIds: [profileId], explicit: true });
      http.expectOne('/api/access/effective?userId=user-id&calendarId=a').flush({ userId: 'user-id', profileIds: [], globalPermissions: [], calendars: [{ calendarId: 'a', profileIds: [profileId], permissions: profileId === 'active' ? ['CALENDAR_VIEW'] : [] }] });
    };
    flushAccess('old'); fixture.detectChanges();
    const inputs = fixture.nativeElement.querySelectorAll('fieldset input') as NodeListOf<HTMLInputElement>;
    expect(inputs[0].checked).toBe(true); expect(inputs[0].disabled).toBe(false);
    inputs[0].click(); fixture.detectChanges();
    expect(inputs[0].checked).toBe(false); expect(inputs[0].disabled).toBe(true);
    component.toggleAccessProfile('old', true);
    expect(component.accessProfileIds()).not.toContain('old');
    inputs[1].click(); component.saveAccess();
    const save = http.expectOne('/api/access/assignments');
    expect(save.request.method).toBe('PUT');
    expect(save.request.body).toEqual({ userId: 'user-id', calendarId: 'a', profileIds: ['active'] });
    save.flush({ userId: 'user-id', calendarId: 'a', profileIds: ['active'], explicit: true });
    flushAccess('active');
    expect(component.accessProfileIds()).toEqual(['active']);
    expect(component.successMessage()).toContain('Acessos do calendário atualizados');
  });

  function prepareSelfManagement(calendarId: string) {
    const http = TestBed.inject(HttpTestingController);
    const target = { ...member('self', calendarId), userId: 'self-id' };
    TestBed.inject(AuthService).currentUser.set({ id: 'self-id', fullName: 'Pessoa', email: target.userEmail,
      role: 'USER', permissions: [], active: true, createdAt: '', updatedAt: '' });
    http.expectOne('/api/calendars').flush([calendar('a'), calendar('b')]);
    http.expectOne('/api/calendars/a/members').flush(calendarId === 'a' ? [target] : []);
    if (calendarId === 'b') {
      component.selectCalendar('b');
      http.expectOne('/api/calendars/b/members').flush([target]);
    }
    component.manageAccess(target);
    http.expectOne('/api/access/permissions').flush([]);
    http.expectOne('/api/access/profiles?calendarId=' + calendarId).flush([
      { id: 'manager', name: 'Gerente', scope: 'CALENDAR', active: true, permissions: ['MEMBERS_MANAGE'] },
      { id: 'viewer', name: 'Leitor', scope: 'CALENDAR', active: true, permissions: ['MEMBERS_VIEW'] },
    ]);
    http.expectOne('/api/access/assignments?userId=self-id&calendarId=' + calendarId).flush({ userId: 'self-id', calendarId, profileIds: ['manager'], explicit: true });
    http.expectOne('/api/access/effective?userId=self-id&calendarId=' + calendarId).flush({ userId: 'self-id', profileIds: [], globalPermissions: [], calendars: [{ calendarId, profileIds: ['manager'], permissions: ['MEMBERS_VIEW', 'MEMBERS_MANAGE'] }] });
    return { http, target };
  }

  it('immediately revokes stale management controls after reducing the actor to a viewer and retains the authorized calendar selection', () => {
    const { http, target } = prepareSelfManagement('b');
    component.toggleAccessProfile('manager', false); component.toggleAccessProfile('viewer', true);
    component.saveAccess();
    http.expectOne('/api/access/assignments').flush({ userId: 'self-id', calendarId: 'b', profileIds: ['viewer'], explicit: true });
    expect(component.canManage()).toBe(false); expect(component.accessMember()).toBeNull();
    expect(component.members()).toEqual([]);
    component.memberEmail.set('new@example.invalid'); component.addMember(); component.manageAccess(target);
    http.expectNone(request => request.method === 'POST' || request.url.startsWith('/api/access'));
    http.expectOne('/api/calendars').flush([calendar('a'), { ...calendar('b'), permissions: ['MEMBERS_VIEW'] }]);
    http.expectOne('/api/calendars/b/members').flush([target]);
    expect(component.selectedCalendarId()).toBe('b'); expect(component.canManage()).toBe(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('form.page-form')).toBeNull();
  });

  it('clears members and does not query them when self-revocation removes every authorized member view', () => {
    const { http } = prepareSelfManagement('a');
    component.toggleAccessProfile('manager', false); component.saveAccess();
    http.expectOne('/api/access/assignments').flush({ userId: 'self-id', calendarId: 'a', profileIds: [], explicit: true });
    expect(component.canManage()).toBe(false); expect(component.members()).toEqual([]);
    http.expectOne('/api/calendars').flush([{ ...calendar('a'), permissions: ['CALENDAR_VIEW'] }]);
    expect(component.selectedCalendarId()).toBe(''); expect(component.members()).toEqual([]);
    expect(component.isLoading()).toBe(false); expect(component.accessMember()).toBeNull();
    http.expectNone(request => request.url.endsWith('/members'));
    component.memberEmail.set('new@example.invalid'); component.addMember();
    http.expectNone(request => request.method === 'POST');
  });

  it('refreshes the actor grants after changing their own legacy role', () => {
    const { http, target } = prepareSelfManagement('b');
    const adminMember = { ...target, role: 'ADMIN' as const, roles: ['ADMIN' as const] };
    component.updateRole(adminMember, 'VIEWER');
    http.expectOne('/api/calendars/b/members/self').flush({ ...target, role: 'VIEWER', roles: ['VIEWER'] });
    expect(component.canManage()).toBe(false); expect(component.members()).toEqual([]);
    component.updateRole(adminMember, 'EDITOR');
    http.expectNone(request => request.method === 'PUT');
    http.expectOne('/api/calendars').flush([{ ...calendar('b'), permissions: ['MEMBERS_VIEW'] }]);
    http.expectOne('/api/calendars/b/members').flush([{ ...target, role: 'VIEWER' }]);
    expect(component.selectedCalendarId()).toBe('b'); expect(component.canManage()).toBe(false);
  });

  it('removes stale member data and grants when the actor leaves a calendar', () => {
    const { http, target } = prepareSelfManagement('a');
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    component.removeMember(target);
    http.expectOne('/api/calendars/a/members/self').flush(null, { status: 204, statusText: 'No Content' });
    expect(component.canManage()).toBe(false); expect(component.members()).toEqual([]);
    http.expectOne('/api/calendars').flush([]);
    expect(component.selectedCalendarId()).toBe(''); expect(component.isLoading()).toBe(false);
    http.expectNone(request => request.url.endsWith('/members'));
    component.memberEmail.set('new@example.invalid'); component.addMember();
    http.expectNone(request => request.method === 'POST');
    confirm.mockRestore();
  });
});
