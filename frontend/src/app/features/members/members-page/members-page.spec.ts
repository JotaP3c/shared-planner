import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { MembersPage } from './members-page';
import { CalendarMemberResponse } from '../../../core/models/shared-planner.models';
import { AuthService } from '../../../core/auth/auth.service';

describe('MembersPage', () => {
  let component: MembersPage;
  let fixture: ComponentFixture<MembersPage>;

  const calendar = (id: string) => ({ id, name: id, ownerEmail: 'owner@example.com', memberRole: 'ADMIN' as const, canCreateEvents: true });
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
    http.expectOne('/api/calendars').flush([{ id: 'calendar', name: 'Agenda', ownerEmail: 'owner@example.com', memberRole: 'VIEWER', canCreateEvents: false }]);
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

    component.memberEmail.set('  Jpcbnu@Gmail.com ');
    component.addMember();
    const request = http.expectOne('/api/calendars/a/members');
    expect(request.request.body).toEqual({ email: 'jpcbnu@gmail.com', role: 'VIEWER' });
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

  it('clears the previous list when loading the new calendar fails', () => {
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/calendars').flush([calendar('a'), calendar('b')]);
    http.expectOne('/api/calendars/a/members').flush([member('ma', 'a')]);

    component.selectCalendar('b');
    http.expectOne('/api/calendars/b/members').flush('x', { status: 500, statusText: 'Server Error' });

    expect(component.members()).toEqual([]);
    expect(component.errorMessage()).toBeTruthy();
  });
});
