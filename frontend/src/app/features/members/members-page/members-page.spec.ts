import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { MembersPage } from './members-page';

describe('MembersPage', () => {
  let component: MembersPage;
  let fixture: ComponentFixture<MembersPage>;

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
});
