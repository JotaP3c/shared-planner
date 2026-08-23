import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AuthService } from '../../../core/auth/auth.service';
import {
  CalendarResponse,
  FinanceSummaryResponse,
  UserResponse,
} from '../../../core/models/shared-planner.models';
import { FinancePage } from './finance-page';

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
    ...overrides,
  });

  beforeEach(async () => {
    currentUser = signal<UserResponse | null>(user('USER'));

    await TestBed.configureTestingModule({
      imports: [FinancePage],
      providers: [
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
  });

  function expectSummaryRequest(calendarId: string, startDate: string, endDate: string) {
    const request = http.expectOne(candidate => candidate.url === '/api/finance/summary');
    expect(request.request.params.get('calendarId')).toBe(calendarId);
    expect(request.request.params.get('startDate')).toBe(startDate);
    expect(request.request.params.get('endDate')).toBe(endDate);
    return request;
  }
});
