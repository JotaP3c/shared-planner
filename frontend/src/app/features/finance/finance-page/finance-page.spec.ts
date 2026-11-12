import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AuthService } from '../../../core/auth/auth.service';
import { provideRouter } from '@angular/router';
import {
  CalendarResponse,
  FinanceSummaryResponse,
  FinanceTimelineResponse,
  UserResponse,
} from '../../../core/models/shared-planner.models';
import { consolidateSummaries, FinancePage } from './finance-page';

describe('FinancePage', () => {
  let component: FinancePage;
  let fixture: ComponentFixture<FinancePage>;
  let http: HttpTestingController;
  let currentUser: WritableSignal<UserResponse | null>;

  const user = (role: UserResponse['role']): UserResponse => ({
    id: 'user-id',
    fullName: 'João da Silva',
    email: 'joao@example.com',
    role,
    active: true,
    createdAt: '2026-08-01T10:00:00',
    updatedAt: '2026-08-01T10:00:00',
  });

  const calendar = (
    id: string,
    memberRole: CalendarResponse['memberRole'],
  ): CalendarResponse => ({
    id,
    name: `Agenda ${id}`,
    ownerEmail: 'owner@example.com',
    memberRole,
    canCreateEvents: memberRole === 'ADMIN',
  });

  const summary = (
    calendarId: string,
    startDate: string,
    endDate: string,
    overrides: Partial<FinanceSummaryResponse> = {},
  ): FinanceSummaryResponse => ({
    calendarId,
    startDate,
    endDate,
    expectedAmount: 1000,
    receivedAmount: 650,
    pendingAmount: 350,
    appointmentCount: 8,
    paidCount: 4,
    pendingCount: 2,
    partiallyPaidCount: 1,
    refundedCount: 1,
    confirmedAmount: 600,
    unconfirmedAmount: 400,
    unscheduledAmount: 0,
    confirmedCount: 5,
    awaitingConfirmationCount: 2,
    rescheduledCount: 1,
    unscheduledCount: 0,
    rescheduleOccurrences: 1,
    ...overrides,
  });

  /** Evolução e recentes são carregados depois do resumo; descarta os pendentes. */
  const flushDetails = (points: FinanceTimelineResponse['points'] = []) => {
    http.match(request => request.url === '/api/finance/timeline')
      .filter(request => !request.cancelled)
      .forEach(request => request.flush({
        calendarId: request.request.params.get('calendarId'),
        startDate: request.request.params.get('startDate'),
        endDate: request.request.params.get('endDate'),
        granularity: 'DAY',
        points,
      }));
    http.match(request => request.url === '/api/finance/appointments')
      .filter(request => !request.cancelled)
      .forEach(request => request.flush([]));
  };

  beforeEach(async () => {
    currentUser = signal<UserResponse | null>(user('USER'));

    await TestBed.configureTestingModule({
      imports: [FinancePage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { currentUser } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FinancePage);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    flushDetails();
    http.verify();
  });

  it('filters USER calendars, requests the inclusive summary and renders every metric', async () => {
    component.setReferenceDate('2028-02-29');
    http.expectOne('/api/calendars').flush([
      calendar('viewer', 'VIEWER'),
      calendar('finance', 'FINANCE'),
      calendar('admin', 'ADMIN'),
    ]);
    await fixture.whenStable();

    expect(component.authorizedCalendars().map(item => item.id)).toEqual(['finance', 'admin']);
    const request = expectSummaryRequest('finance', '2028-02-01', '2028-02-29');
    request.flush(summary('finance', '2028-02-01', '2028-02-29'));
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('[data-testid="expected-amount"]')?.textContent).toContain('R$');
    expect(element.querySelector('[data-testid="received-amount"]')?.textContent).toContain('650');
    expect(element.querySelector('[data-testid="pending-amount"]')?.textContent).toContain('350');
    expect(element.querySelector('[data-testid="appointment-count"]')?.textContent?.trim()).toBe('8');
    expect(element.querySelector('[data-testid="paid-count"]')?.textContent?.trim()).toBe('4');
    expect(element.querySelector('[data-testid="pending-count"]')?.textContent?.trim()).toBe('2');
    expect(element.querySelector('[data-testid="partially-paid-count"]')?.textContent?.trim()).toBe('1');
    expect(element.querySelector('[data-testid="refunded-count"]')?.textContent?.trim()).toBe('1');

    // Donut de pagamento: QUANTIDADE real, 4/8 pagos = 50%.
    const chart = element.querySelector('[data-testid="payment-status-chart"]');
    expect(chart).not.toBeNull();
    expect(chart?.querySelector('[role="img"]')?.getAttribute('aria-label')).toContain('Pago 4 (50%)');
    expect(chart?.querySelector('[data-testid="donut-legend-paid"]')?.textContent).toContain('50%');
    expect(chart?.querySelectorAll('[data-testid^="donut-segment-"]').length).toBe(4);

    // Confirmação em gráfico separado, sem misturar com pagamento.
    const confirmation = element.querySelector('[data-testid="confirmation-chart"]');
    expect(confirmation?.textContent).toContain('Confirmados');
    expect(confirmation?.textContent).not.toContain('Reembolsado');
    expect(element.querySelector('[data-testid="confirmed-count"]')?.textContent?.trim()).toBe('5');
    expect(element.querySelector('[data-testid="confirmed-amount"]')?.textContent).toContain('600');
  });

  it('loads the revenue evolution and recent appointments for the applied period', async () => {
    component.setReferenceDate('2026-11-11');
    http.expectOne('/api/calendars').flush([calendar('finance', 'FINANCE')]);
    await fixture.whenStable();
    expectSummaryRequest('finance', '2026-11-01', '2026-11-30')
      .flush(summary('finance', '2026-11-01', '2026-11-30'));

    const timeline = http.expectOne(request => request.url === '/api/finance/timeline');
    expect(timeline.request.params.get('startDate')).toBe('2026-11-01');
    expect(timeline.request.params.get('endDate')).toBe('2026-11-30');
    timeline.flush({
      calendarId: 'finance', startDate: '2026-11-01', endDate: '2026-11-30', granularity: 'DAY',
      points: [
        { date: '2026-11-11', expectedAmount: 50, receivedAmount: 50, appointmentCount: 1 },
        { date: '2026-11-12', expectedAmount: 100, receivedAmount: 0, appointmentCount: 1 },
      ],
    });
    http.expectOne(request => request.url === '/api/finance/appointments').flush([{
      eventId: 'e1', calendarId: 'finance', startsAt: '2026-11-11T15:00:00', clientName: 'joao teste',
      workDescription: 'Corte', amount: 50, receivedAmount: 50, paymentStatus: 'PAID', confirmationStatus: 'CONFIRMED',
    }]);
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    expect(component.timelinePoints().map(point => point.label)).toEqual(['11/11', '12/11']);
    expect(element.querySelector('[data-testid="revenue-evolution-chart"] svg')).not.toBeNull();
    const recent = element.querySelector('[data-testid="recent-appointments"]');
    expect(recent?.textContent).toContain('joao teste');
    expect(recent?.textContent).toContain('Confirmado');
    expect(recent?.textContent).toContain('Pago');
    expect(recent?.querySelector('a')?.getAttribute('href')).toContain('eventId=e1');
  });

  it('keeps the visible period select in sync with the applied period (INC-05a)', async () => {
    component.setReferenceDate('2026-11-11');
    http.expectOne('/api/calendars').flush([calendar('finance', 'FINANCE')]);
    await fixture.whenStable();
    expectSummaryRequest('finance', '2026-11-01', '2026-11-30')
      .flush(summary('finance', '2026-11-01', '2026-11-30'));
    fixture.detectChanges();

    const select = fixture.nativeElement.querySelector('[data-testid="finance-period-select"]') as HTMLSelectElement;
    // Antes da correção o navegador exibia "Diário" (1ª opção) com o estado em MONTHLY.
    expect(select.value).toBe('MONTHLY');
    expect(select.selectedOptions[0].textContent).toContain('Mensal');

    select.value = 'DAILY';
    select.dispatchEvent(new Event('change'));
    component.applyFilters();
    expectSummaryRequest('finance', '2026-11-11', '2026-11-11')
      .flush(summary('finance', '2026-11-11', '2026-11-11'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="finance-active-period"]')?.textContent)
      .toContain('11 de nov. de 2026');
  });

  it('applies global ADMIN and global FINANCE membership rules before requesting finance', async () => {
    currentUser.set(user('ADMIN'));
    component.setReferenceDate('2026-08-20');
    http.expectOne('/api/calendars').flush([
      calendar('unlinked', null),
      calendar('viewer', 'VIEWER'),
      calendar('finance', 'FINANCE'),
    ]);
    await fixture.whenStable();

    expect(component.authorizedCalendars().map(item => item.id)).toEqual([
      'unlinked',
      'viewer',
      'finance',
    ]);
    expectSummaryRequest('unlinked', '2026-08-01', '2026-08-31')
      .flush(summary('unlinked', '2026-08-01', '2026-08-31'));

    currentUser.set(user('FINANCE'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.authorizedCalendars().map(item => item.id)).toEqual(['viewer', 'finance']);
    expectSummaryRequest('viewer', '2026-08-01', '2026-08-31')
      .flush(summary('viewer', '2026-08-01', '2026-08-31'));
  });

  it('uses inclusive civil limits for every supported period', async () => {
    component.setReferenceDate('2028-02-29');
    http.expectOne('/api/calendars').flush([calendar('finance', 'FINANCE')]);
    await fixture.whenStable();
    expectSummaryRequest('finance', '2028-02-01', '2028-02-29')
      .flush(summary('finance', '2028-02-01', '2028-02-29'));

    const cases: Array<{
      period: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
      reference: string;
      start: string;
      end: string;
    }> = [
      { period: 'DAILY', reference: '2028-02-29', start: '2028-02-29', end: '2028-02-29' },
      { period: 'WEEKLY', reference: '2027-01-01', start: '2026-12-28', end: '2027-01-03' },
      { period: 'BIWEEKLY', reference: '2028-02-15', start: '2028-02-01', end: '2028-02-15' },
      { period: 'BIWEEKLY', reference: '2028-02-16', start: '2028-02-16', end: '2028-02-29' },
      { period: 'MONTHLY', reference: '2026-12-31', start: '2026-12-01', end: '2026-12-31' },
    ];

    for (const item of cases) {
      component.selectPeriod(item.period);
      component.setReferenceDate(item.reference);
      component.applyFilters();
      expectSummaryRequest('finance', item.start, item.end)
        .flush(summary('finance', item.start, item.end));
    }

    component.selectPeriod('CUSTOM');
    component.setCustomStartDate('2026-12-31');
    component.setCustomEndDate('2027-01-02');
    component.applyFilters();
    expectSummaryRequest('finance', '2026-12-31', '2027-01-02')
      .flush(summary('finance', '2026-12-31', '2027-01-02'));
  });

  it('shows a calendar loading error and offers retry instead of a blank page', () => {
    http.expectOne('/api/calendars').flush(
      { detail: 'Calendários indisponíveis.' },
      { status: 503, statusText: 'Service Unavailable' },
    );
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    expect(component.calendarErrorMessage()).toBe('Calendários indisponíveis.');
    expect(element.textContent).toContain('Não foi possível abrir o financeiro');
    expect(element.textContent).toContain('Tentar novamente');
  });

  it('does not request or render finance when USER only has VIEWER access', async () => {
    http.expectOne('/api/calendars').flush([calendar('viewer', 'VIEWER')]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.authorizedCalendars()).toEqual([]);
    expect(fixture.nativeElement.querySelector('[data-testid="finance-no-access"]')).not.toBeNull();
    http.expectNone(request => request.url === '/api/finance/summary');
  });

  it('hides an applied summary as soon as a draft filter changes and exposes request errors', async () => {
    component.setReferenceDate('2026-08-20');
    http.expectOne('/api/calendars').flush([calendar('finance', 'FINANCE')]);
    await fixture.whenStable();
    expectSummaryRequest('finance', '2026-08-01', '2026-08-31')
      .flush(summary('finance', '2026-08-01', '2026-08-31'));
    fixture.detectChanges();
    expect(component.summary()).not.toBeNull();

    component.selectPeriod('DAILY');
    component.setReferenceDate('2026-08-22');
    fixture.detectChanges();
    expect(component.summary()).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="expected-amount"]')).toBeNull();

    component.applyFilters();
    expectSummaryRequest('finance', '2026-08-22', '2026-08-22').flush(
      { detail: 'Acesso financeiro revogado.' },
      { status: 403, statusText: 'Forbidden' },
    );
    fixture.detectChanges();
    expect(component.errorMessage()).toBe('Acesso financeiro revogado.');
    expect(fixture.nativeElement.textContent).toContain('Não foi possível atualizar o resumo');
  });

  it('renders an explicit empty state while keeping all zero-value cards', async () => {
    component.setReferenceDate('2026-08-20');
    http.expectOne('/api/calendars').flush([calendar('finance', 'FINANCE')]);
    await fixture.whenStable();
    expectSummaryRequest('finance', '2026-08-01', '2026-08-31').flush(
      summary('finance', '2026-08-01', '2026-08-31', {
        expectedAmount: 0,
        receivedAmount: 0,
        pendingAmount: 0,
        appointmentCount: 0,
        paidCount: 0,
        pendingCount: 0,
        partiallyPaidCount: 0,
        refundedCount: 0,
      }),
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="finance-empty"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="expected-amount"]')).not.toBeNull();
    // Período vazio não gera gráfico fictício.
    expect(fixture.nativeElement.querySelector('[data-testid="payment-status-chart"]')).toBeNull();
  });

  it('consolidates only authorized selected calendars and keeps received and pending independent', async () => {
    component.setReferenceDate('2026-10-11');
    http.expectOne('/api/calendars').flush([calendar('joao', 'ADMIN'), calendar('malu', 'FINANCE'), calendar('private', 'VIEWER')]);
    await fixture.whenStable();
    expectSummaryRequest('joao', '2026-10-01', '2026-10-31').flush(summary('joao', '2026-10-01', '2026-10-31'));
    flushDetails();
    component.setConsolidated(true);
    const requests = http.match(request => request.url === '/api/finance/summary');
    expect(requests.map(request => request.request.params.get('calendarId'))).toEqual(['joao', 'malu']);
    requests.forEach(request => request.flush(summary(request.request.params.get('calendarId')!, '2026-10-01', '2026-10-31', {
      expectedAmount: 495, receivedAmount: 230, pendingAmount: 290,
    })));
    expect(component.summary()?.expectedAmount).toBe(990);
    expect(component.summary()?.receivedAmount).toBe(460);
    expect(component.summary()?.pendingAmount).toBe(580);
    expect(component.calendarScopeLabel()).toContain('2 calendários');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Saldo dos atendimentos não desmarcados');
    component.chartsCollapsed.set(true); fixture.detectChanges();
    expect((fixture.nativeElement.querySelector('#finance-charts') as HTMLElement).hidden).toBe(true);
  });

  it('adds authoritative quarterly fixture metrics in cents without deriving pending from expected minus received', () => {
    http.expectOne('/api/calendars').flush([]);
    for (const factor of [1, 2, 3]) {
      const result = consolidateSummaries(['joao', 'malu'].map(id => summary(id, '', '', {
        expectedAmount: 495 * factor, receivedAmount: 230 * factor, pendingAmount: 290 * factor,
      })));
      expect([result.expectedAmount, result.receivedAmount, result.pendingAmount]).toEqual([990 * factor, 460 * factor, 580 * factor]);
    }
  });

  function expectSummaryRequest(calendarId: string, startDate: string, endDate: string) {
    const request = http.expectOne(candidate => candidate.url === '/api/finance/summary');
    expect(request.request.params.get('calendarId')).toBe(calendarId);
    expect(request.request.params.get('startDate')).toBe(startDate);
    expect(request.request.params.get('endDate')).toBe(endDate);
    return request;
  }
});
