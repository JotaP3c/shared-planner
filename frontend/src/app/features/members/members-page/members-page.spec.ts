import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { MembersPage } from './members-page';
import { CalendarMemberResponse } from '../../../core/models/shared-planner.models';

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
