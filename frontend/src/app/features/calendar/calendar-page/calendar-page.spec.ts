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

  it('does not render or open financial controls for a redacted CLIENT event', () => {
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

    const redactedEvent = {
      id: 'redacted-event',
      calendarId: 'calendar',
      createdByEmail: 'owner@example.com',
      approvalRequestedFromEmail: null,
      approvedByEmail: null,
      eventType: 'CLIENT',
      status: 'SCHEDULED',
      title: 'Atendimento protegido',
      clientName: 'Cliente',
      personName: null,
      description: null,
      workDescription: 'Serviço',
      startsAt: '2026-08-24T10:00:00',
      endsAt: '2026-08-24T11:00:00',
    } satisfies EventResponse;

    component.selectedEvent.set(redactedEvent);
    fixture.detectChanges();

    const panel: HTMLElement | null = fixture.nativeElement.querySelector('.event-detail-panel');
    expect(component.hasFinancialDetails(redactedEvent)).toBe(false);
    expect(panel?.querySelector('.detail-amount')).toBeNull();
    expect(panel?.querySelector('.detail-payment')).toBeNull();
    expect(panel?.querySelector('.detail-received')).toBeNull();
    expect(panel?.querySelector('.detail-method')).toBeNull();
    expect(panel?.querySelector('.detail-paid')).toBeNull();
    expect(panel?.querySelector('.payment-form')).toBeNull();
    expect(panel?.querySelector('.payment-action-icon')).toBeNull();

    component.togglePaymentForm(redactedEvent);
    expect(component.isPaymentFormOpen()).toBe(false);
  });

  it('recognizes financial access when nullable payment metadata is omitted', () => {
    const pendingEvent = {
      id: 'pending-payment',
      calendarId: 'calendar',
      createdByEmail: 'admin@example.com',
      approvalRequestedFromEmail: null,
      approvedByEmail: null,
      eventType: 'CLIENT',
      status: 'SCHEDULED',
      title: 'Atendimento',
      clientName: 'Cliente',
      personName: null,
      description: null,
      workDescription: 'Serviço',
      amount: 100,
      paymentStatus: 'PENDING',
      receivedAmount: 0,
      startsAt: '2026-08-24T10:00:00',
      endsAt: '2026-08-24T11:00:00',
    } satisfies EventResponse;

    expect(component.hasFinancialDetails(pendingEvent)).toBe(true);
  });
});
