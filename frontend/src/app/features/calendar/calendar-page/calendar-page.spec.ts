import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { CalendarPage } from './calendar-page';
import { AuthService } from '../../../core/auth/auth.service';
import { EventResponse } from '../../../core/models/shared-planner.models';

describe('CalendarPage', () => {
  let component: CalendarPage;
  let fixture: ComponentFixture<CalendarPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CalendarPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(CalendarPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not offer edit actions for cancelled events', () => {
    const authService = TestBed.inject(AuthService);
    authService.currentUser.set({
      id: 'admin',
      fullName: 'Admin',
      email: 'admin@example.com',
      role: 'ADMIN',
      active: true,
      createdAt: '',
      updatedAt: '',
    });

    const cancelledEvent = {
      id: 'event',
      calendarId: 'calendar',
      createdByEmail: 'admin@example.com',
      approvalRequestedFromEmail: null,
      approvedByEmail: null,
      eventType: 'CLIENT',
      status: 'CANCELLED',
      title: 'Cancelled appointment',
      clientName: 'Client',
      personName: null,
      description: null,
      workDescription: 'Service',
      amount: 50,
      paymentStatus: 'PENDING',
      paymentMethod: null,
      receivedAmount: 0,
      paidAt: null,
      startsAt: '2026-08-24T10:00:00',
      endsAt: '2026-08-24T11:00:00',
    } satisfies EventResponse;

    expect(component.canEditEvent(cancelledEvent)).toBe(false);
  });
});
