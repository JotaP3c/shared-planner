import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { AppointmentConfirmation } from './appointment-confirmation';
import { EventResponse } from '../../../core/models/shared-planner.models';

describe('AppointmentConfirmation', () => {
  let fixture: ComponentFixture<AppointmentConfirmation>;
  let component: AppointmentConfirmation;
  let http: HttpTestingController;
  let emitted: EventResponse[];

  const clientEvent = (overrides: Partial<EventResponse> = {}): EventResponse => ({
    id: 'event-1',
    calendarId: 'cal',
    createdByEmail: 'admin@example.com',
    approvalRequestedFromEmail: null,
    approvedByEmail: null,
    eventType: 'CLIENT',
    status: 'SCHEDULED',
    title: 'joao teste',
    clientName: 'joao teste',
    personName: null,
    description: null,
    workDescription: 'Corte',
    amount: 50,
    paymentStatus: 'PENDING',
    receivedAmount: 0,
    startsAt: '2026-11-11T15:00:00',
    endsAt: '2026-11-11T15:45:00',
    confirmationStatus: 'PENDING_CONFIRMATION',
    rescheduleCount: 0,
    ...overrides,
  });

  const element = () => fixture.nativeElement as HTMLElement;
  const query = (testId: string) => element().querySelector(`[data-testid="${testId}"]`) as HTMLElement | null;

  function setup(event: EventResponse, canManage = true) {
    fixture = TestBed.createComponent(AppointmentConfirmation);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('event', event);
    fixture.componentRef.setInput('canManage', canManage);
    emitted = [];
    component.updated.subscribe(value => emitted.push(value));
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppointmentConfirmation],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    http.verify();
  });

  it('shows the current status and never confirms just by rendering', () => {
    setup(clientEvent());

    expect(query('confirmation-status')?.textContent).toContain('Aguardando confirmação');
    http.expectNone(() => true);
  });

  it('confirms only after explicit confirmation and emits the updated event', () => {
    setup(clientEvent());
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    query('confirm-appointment')!.click();
    http.expectNone('/api/events/event-1/confirm');

    confirmSpy.mockReturnValue(true);
    query('confirm-appointment')!.click();
    const request = http.expectOne('/api/events/event-1/confirm');
    expect(request.request.method).toBe('POST');
    request.flush(clientEvent({ confirmationStatus: 'CONFIRMED', paymentStatus: 'PENDING' }));

    expect(emitted[0].confirmationStatus).toBe('CONFIRMED');
    // Confirmar não altera o pagamento.
    expect(emitted[0].paymentStatus).toBe('PENDING');
  });

  it('requires a reason and a justification for "Outros"', () => {
    setup(clientEvent());
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    query('open-unschedule')!.click();
    fixture.detectChanges();
    query('submit-unschedule')!.click();
    fixture.detectChanges();
    expect(query('unschedule-error')?.textContent).toContain('motivo');

    (query('reason-OTHER') as HTMLInputElement).click();
    fixture.detectChanges();
    query('submit-unschedule')!.click();
    fixture.detectChanges();
    expect(query('unschedule-error')?.textContent).toContain('Outros');
    http.expectNone('/api/events/event-1/unschedule');

    component.unscheduleForm.controls.notes.setValue('Viagem');
    query('submit-unschedule')!.click();
    const request = http.expectOne('/api/events/event-1/unschedule');
    expect(request.request.body).toEqual({ reason: 'OTHER', notes: 'Viagem', newStartsAt: null, newEndsAt: null });
    request.flush(clientEvent({ confirmationStatus: 'CANCELLED', unscheduleReason: 'OTHER', unscheduleNotes: 'Viagem' }));
    expect(emitted[0].confirmationStatus).toBe('CANCELLED');
  });

  it('reschedules the same event with the new period', () => {
    setup(clientEvent({ confirmationStatus: 'CONFIRMED' }));
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    query('open-unschedule')!.click();
    fixture.detectChanges();
    (query('reason-RESCHEDULE') as HTMLInputElement).click();
    fixture.detectChanges();
    expect(query('reschedule-date')).not.toBeNull();

    component.unscheduleForm.patchValue({ newDate: '2026-11-13', newStartTime: '10:00', newEndTime: '10:45' });
    query('submit-unschedule')!.click();
    const request = http.expectOne('/api/events/event-1/unschedule');
    expect(request.request.body).toEqual({
      reason: 'RESCHEDULE',
      notes: null,
      newStartsAt: '2026-11-13T10:00:00',
      newEndsAt: '2026-11-13T10:45:00',
    });
    request.flush(clientEvent({ confirmationStatus: 'RESCHEDULED', startsAt: '2026-11-13T10:00:00', rescheduleCount: 1 }));
    expect(emitted[0].rescheduleCount).toBe(1);
  });

  it('rejects a reschedule that keeps the same period without calling the API', () => {
    setup(clientEvent());
    query('open-unschedule')!.click();
    fixture.detectChanges();
    (query('reason-RESCHEDULE') as HTMLInputElement).click();
    query('submit-unschedule')!.click();
    fixture.detectChanges();

    expect(query('unschedule-error')?.textContent).toContain('diferente');
    http.expectNone('/api/events/event-1/unschedule');
  });

  it('hides actions without permission and for unscheduled appointments', () => {
    setup(clientEvent(), false);
    expect(query('confirm-appointment')).toBeNull();
    expect(query('open-unschedule')).toBeNull();

    setup(clientEvent({ confirmationStatus: 'CANCELLED', unscheduleReason: 'GAVE_UP' }), true);
    expect(query('confirm-appointment')).toBeNull();
    expect(query('open-unschedule')).toBeNull();
    expect(element().textContent).toContain('Desistência');
  });

  it('shows a clear message when the backend refuses a stale transition (409)', () => {
    setup(clientEvent());
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    query('confirm-appointment')!.click();
    http.expectOne('/api/events/event-1/confirm').flush({}, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();

    expect(query('confirmation-error')?.textContent).toContain('mudou');
    expect(emitted).toEqual([]);
  });

  it('loads the confirmation history on demand', () => {
    setup(clientEvent());
    (element().querySelector('.history-toggle') as HTMLElement).click();
    http.expectOne('/api/events/event-1/confirmation-history').flush([{
      id: 'h1', eventId: 'event-1', previousStatus: 'PENDING_CONFIRMATION', newStatus: 'CONFIRMED', reason: null,
      notes: null, previousStartsAt: null, previousEndsAt: null, newStartsAt: null, newEndsAt: null,
      performedByEmail: 'admin@example.com', performedAt: '2026-11-11T14:00:00',
    }]);
    fixture.detectChanges();

    expect(query('confirmation-history')?.textContent).toContain('Aguardando confirmação → Confirmado');
  });
});
