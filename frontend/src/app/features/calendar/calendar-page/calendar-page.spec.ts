import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { CalendarPage } from './calendar-page';
import { AuthService } from '../../../core/auth/auth.service';
import { EventResponse } from '../../../core/models/shared-planner.models';
import { DataChangeService } from '../../../core/state/data-change.service';

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

  it('collapses the right panel independently and lets the calendar take the space (INC-06)', () => {
    localStorage.removeItem('sharedPlanner.layout');
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('[data-testid="finance-summary-card"], .side-card')).not.toBeNull();

    (element.querySelector('[data-testid="side-panel-toggle"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(element.querySelector('.calendar-layout')?.classList).toContain('side-collapsed');
    expect(element.querySelector('.side-card')).toBeNull();
    const toggle = element.querySelector('[data-testid="side-panel-toggle"]') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-label')).toBe('Mostrar painel de resumo');

    toggle.click();
    fixture.detectChanges();
    expect(element.querySelector('.side-card')).not.toBeNull();
    localStorage.removeItem('sharedPlanner.layout');
  });

  it('renders the event detail in sections with the appointment confirmation for CLIENT', () => {
    TestBed.inject(AuthService).currentUser.set({
      id: 'admin', fullName: 'Admin', email: 'admin@example.com', role: 'ADMIN', active: true, createdAt: '', updatedAt: '',
    });
    component.selectedEvent.set({
      id: 'e1', calendarId: 'cal', createdByEmail: 'admin@example.com', approvalRequestedFromEmail: null,
      approvedByEmail: null, eventType: 'CLIENT', status: 'SCHEDULED', title: 'joao teste', clientName: 'joao teste',
      personName: null, description: 'joao teste', workDescription: 'Corte', amount: 50, paymentStatus: 'PAID',
      paymentMethod: 'PIX', receivedAmount: 50, paidAt: '2026-11-11T14:25:00',
      startsAt: '2026-11-11T15:00:00', endsAt: '2026-11-11T15:45:00', confirmationStatus: 'CONFIRMED',
    });
    fixture.detectChanges();

    const panel = fixture.nativeElement.querySelector('.event-detail-panel') as HTMLElement;
    expect(panel.querySelector('[data-testid="detail-finance"]')?.textContent).toContain('Pendente');
    expect(panel.textContent).toContain('45 min');
    expect(panel.querySelector('app-appointment-confirmation [data-testid="confirmation-status"]')?.textContent)
      .toContain('Confirmado');
    expect(panel.textContent).toContain('Registrar pagamento');
  });

  it('never applies a duration different from the chosen one near midnight (BLG-UX-004)', () => {
    component.eventForm.controls.startTime.setValue('23:00');
    component.eventForm.controls.endTime.setValue('23:30');

    expect(component.availableDurations()).toEqual([15, 30, 45]);

    component.onDurationChange('120');
    expect(component.eventForm.controls.endTime.value).toBe('23:30');
    expect(component.eventFormError()).toContain('23:59');

    component.onDurationChange('45');
    expect(component.eventForm.controls.endTime.value).toBe('23:45');
    expect(component.eventFormError()).toBe('');
  });

  it('reloads the monthly finance summary after a data change', () => {
    const http = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).currentUser.set({
      id: 'admin', fullName: 'Admin', email: 'admin@example.com', role: 'ADMIN', active: true, createdAt: '', updatedAt: '',
    });
    component.calendars.set([{
      id: 'cal', name: 'Agenda', ownerEmail: 'admin@example.com', memberRole: 'ADMIN', canCreateEvents: true,
    }]);
    TestBed.tick();

    const summary = {
      calendarId: 'cal', startDate: '', endDate: '', expectedAmount: 100, receivedAmount: 0, pendingAmount: 100,
      appointmentCount: 1, paidCount: 0, pendingCount: 1, partiallyPaidCount: 0, refundedCount: 0,
    };
    const first = http.match(request => request.url === '/api/finance/summary');
    expect(first.length).toBe(2);
    first.forEach(request => request.flush(summary));

    TestBed.inject(DataChangeService).notify();
    TestBed.tick();

    const second = http.match(request => request.url === '/api/finance/summary');
    expect(second.length).toBe(2);
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

describe('CalendarPage async states and validation (BLG-BUG-004/005/008, BLG-FE-007)', () => {
  let component: CalendarPage;
  let http: HttpTestingController;

  const calendarA = { id: 'cal-a', name: 'Agenda A', ownerEmail: 'owner@example.com', memberRole: 'ADMIN' as const, canCreateEvents: true };
  const calendarB = { id: 'cal-b', name: 'Agenda B', ownerEmail: 'owner@example.com', memberRole: 'ADMIN' as const, canCreateEvents: true };

  function event(id: string, overrides: Partial<EventResponse> = {}): EventResponse {
    return {
      id,
      calendarId: 'cal-a',
      createdByEmail: 'owner@example.com',
      approvalRequestedFromEmail: 'user@example.com',
      approvedByEmail: null,
      eventType: 'SHARED',
      status: 'PENDING_APPROVAL',
      title: `Evento ${id}`,
      clientName: null,
      personName: null,
      description: null,
      workDescription: null,
      startsAt: '2026-08-24T10:00:00',
      endsAt: '2026-08-24T11:00:00',
      ...overrides,
    };
  }

  const eventsFor = (calendarId: string) => (req: { url: string; params: { get(name: string): string | null } }) =>
    req.url === '/api/events' && req.params.get('calendarId') === calendarId;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CalendarPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    const fixture = TestBed.createComponent(CalendarPage);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).currentUser.set({
      id: 'user', fullName: 'User', email: 'user@example.com', role: 'USER', active: true, createdAt: '', updatedAt: '',
    });
    await fixture.whenStable();

    // Cargas iniciais do ngOnInit; o estado sob teste é montado manualmente abaixo.
    http.match('/api/events/pending-approvals').forEach(req => req.flush([]));
    http.match('/api/calendars').forEach(req => req.flush([]));
    http.match(req => req.url === '/api/events').forEach(req => req.flush([]));

    component.calendars.set([calendarA, calendarB]);
    component.selectedCalendarIds.set(['cal-a', 'cal-b']);
    component.visibleStart.set(new Date(2026, 7, 1));
    component.visibleEnd.set(new Date(2026, 8, 1));
  });

  function loadEvents(): void {
    (component as unknown as { loadEvents(): void }).loadEvents();
  }

  it('exposes a total load failure instead of presenting an empty agenda', () => {
    loadEvents();
    http.expectOne(eventsFor('cal-a')).flush('x', { status: 500, statusText: 'Server Error' });
    http.expectOne(eventsFor('cal-b')).flush('x', { status: 500, statusText: 'Server Error' });

    expect(component.eventsLoadError()).toContain('Não foi possível carregar os eventos');
    expect(component.isLoading()).toBe(false);
  });

  it('identifies a partial failure by calendar and keeps the successful events', () => {
    loadEvents();
    http.expectOne(eventsFor('cal-a')).flush([event('a1', { calendarId: 'cal-a' })]);
    http.expectOne(eventsFor('cal-b')).flush('x', { status: 500, statusText: 'Server Error' });

    expect(component.events().map(item => item.id)).toEqual(['a1']);
    expect(component.eventsLoadError()).toContain('Agenda B');
  });

  it('keeps only the latest request (latest-wins) and holds loading until it completes', () => {
    component.selectedCalendarIds.set(['cal-a']);
    loadEvents();
    const stale = http.expectOne(eventsFor('cal-a'));

    component.visibleStart.set(new Date(2026, 8, 1));
    component.visibleEnd.set(new Date(2026, 9, 1));
    loadEvents();
    const latest = http.match(eventsFor('cal-a')).find(req => !req.cancelled);

    expect(stale.cancelled).toBe(true);
    expect(component.isLoading()).toBe(true);

    latest?.flush([event('september', { calendarId: 'cal-a' })]);

    expect(component.events().map(item => item.id)).toEqual(['september']);
    expect(component.isLoading()).toBe(false);
  });

  it('does not report "no pending items" when the pending queue fails to load', () => {
    (component as unknown as { loadPendingApprovals(): void }).loadPendingApprovals();
    expect(component.isPendingLoading()).toBe(true);

    http.expectOne('/api/events/pending-approvals').flush('x', { status: 500, statusText: 'Server Error' });

    expect(component.pendingLoadError()).toContain('pendências');
    expect(component.isPendingLoading()).toBe(false);
  });

  it('tracks concurrent approvals per event', () => {
    const first = event('first');
    const second = event('second');
    const respond = component as unknown as { respondToEvent(e: EventResponse, a: 'approve' | 'reject'): void };

    respond.respondToEvent(first, 'approve');
    respond.respondToEvent(second, 'approve');
    http.expectOne('/api/events/first/approve').flush({ ...first, status: 'APPROVED' });

    expect(component.isPendingActionInProgress('first')).toBe(false);
    expect(component.isPendingActionInProgress('second')).toBe(true);

    // Clique repetido no item ainda em andamento não dispara nova requisição.
    respond.respondToEvent(second, 'approve');
    http.expectOne('/api/events/second/approve').flush({ ...second, status: 'APPROVED' });
    expect(component.isPendingActionInProgress('second')).toBe(false);
  });

  function fillForm(values: Record<string, string>): void {
    component.eventForm.patchValue({
      calendarId: 'cal-a',
      date: '2026-08-24',
      startTime: '10:00',
      endTime: '11:00',
      ...values,
    } as never);
  }

  function expectNoSave(): void {
    expect(http.match(req => req.method === 'POST' && req.url === '/api/events')).toHaveLength(0);
  }

  it('rejects a title made only of spaces', () => {
    fillForm({ eventType: 'PERSONAL', title: '   ', personName: 'Pessoa' });
    component.submitEventForm();

    expect(component.eventFormError()).toContain('título');
    expectNoSave();
  });

  it('requires the service description for CLIENT events', () => {
    fillForm({ eventType: 'CLIENT', title: 'Atendimento', clientName: 'Cliente', amount: '100', workDescription: '  ' });
    component.submitEventForm();

    expect(component.eventFormError()).toContain('descrição do serviço');
    expectNoSave();
  });

  it('requires a valid approval e-mail for SHARED events', () => {
    fillForm({ eventType: 'SHARED', title: 'Reunião', approvalRequestedFromEmail: 'nao-e-email' });
    component.submitEventForm();

    expect(component.eventFormError()).toContain('e-mail válido');
    expectNoSave();
  });

  it('submits a complete CLIENT event', () => {
    fillForm({ eventType: 'CLIENT', title: ' Atendimento ', clientName: 'Cliente', amount: '100', workDescription: 'Corte' });
    component.submitEventForm();

    const request = http.expectOne(req => req.method === 'POST' && req.url === '/api/events');
    expect(request.request.body.title).toBe('Atendimento');
    expect(request.request.body.workDescription).toBe('Corte');
  });
});
