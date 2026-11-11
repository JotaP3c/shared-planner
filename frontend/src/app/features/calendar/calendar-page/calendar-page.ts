import { AfterViewInit, Component, DestroyRef, OnInit, ViewChild, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { FullCalendarComponent, FullCalendarModule } from '@fullcalendar/angular';
import { CalendarOptions, DatesSetArg, EventInput } from '@fullcalendar/core';
import ptBrLocale from '@fullcalendar/core/locales/pt-br';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import timeGridPlugin from '@fullcalendar/timegrid';
import { Subscription, catchError, distinctUntilChanged, finalize, forkJoin, map, of } from 'rxjs';

import { CalendarService } from '../../../core/api/calendar.service';
import { EventService } from '../../../core/api/event.service';
import { FinanceService } from '../../../core/api/finance.service';
import { financeAuthorizedCalendars } from '../../../core/auth/finance-access';
import { Icon, IconName } from '../../../shared/ui/icon/icon';
import { SearchService } from '../../../core/api/search.service';
import { DataChangeService } from '../../../core/state/data-change.service';
import { DialogFocusDirective } from '../../../shared/a11y/dialog-focus.directive';
import { AppointmentConfirmation } from '../appointment-confirmation/appointment-confirmation';
import { AuthService } from '../../../core/auth/auth.service';
import {
  CalendarResponse,
  CreateEventRequest,
  EventResponse,
  EventType,
  PaymentMethod,
  PaymentStatus,
  UpdateEventRequest,
  UpdatePaymentRequest,
} from '../../../core/models/shared-planner.models';

type CalendarViewName = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay';

/** Totais reais de /api/finance/summary somados entre os calendários autorizados. */
interface MonthlyFinanceSummary {
  monthLabel: string;
  expectedAmount: number;
  receivedAmount: number;
  pendingAmount: number;
  appointmentCount: number;
  previousExpectedAmount: number;
}

@Component({
  selector: 'app-calendar-page',
  imports: [FullCalendarModule, ReactiveFormsModule, Icon, DialogFocusDirective, AppointmentConfirmation],
  templateUrl: './calendar-page.html',
  styleUrl: './calendar-page.scss',
})
export class CalendarPage implements OnInit, AfterViewInit {
  @ViewChild('calendar') calendarComponent?: FullCalendarComponent;

  private static readonly EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  private readonly calendarService = inject(CalendarService);
  private readonly eventService = inject(EventService);
  private readonly financeService = inject(FinanceService);
  private readonly dataChanges = inject(DataChangeService);
  private financeSubscription: Subscription | null = null;
  /** Relógio local (atualiza a cada minuto) para os "Próximos eventos" acompanharem o tempo. */
  readonly clock = signal(Date.now());
  private clockTimerId: ReturnType<typeof setInterval> | null = null;
  private financeRequestKey = '';
  private readonly searchService = inject(SearchService);
  private readonly authService = inject(AuthService);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private pendingSearchTarget: { eventId: string; calendarId: string; date: string } | null = null;

  readonly isEventModalOpen = signal(false);
  readonly isSavingEvent = signal(false);
  readonly eventFormError = signal('');
  readonly eventDetailError = signal('');
  readonly formEventType = signal<EventType>('CLIENT');
  readonly selectedEvent = signal<EventResponse | null>(null);
  readonly eventBeingEdited = signal<EventResponse | null>(null);
  readonly isEditMode = signal(false);
  readonly isDeletingEvent = signal(false);
  readonly isUpdatingApproval = signal(false);
  readonly isUpdatingPayment = signal(false);
  readonly isPaymentFormOpen = signal(false);
  readonly paymentFormError = signal('');
  /** BLG-BUG-008: aprovações/reprovações concorrentes são rastreadas por evento. */
  readonly pendingActionEventIds = signal<ReadonlySet<string>>(new Set());
  /** BLG-BUG-004: falha de carga de eventos é um estado próprio, nunca uma agenda vazia. */
  readonly eventsLoadError = signal('');
  readonly isPendingLoading = signal(false);
  readonly pendingLoadError = signal('');
  private eventsSubscription: Subscription | null = null;
  private eventsRequestId = 0;
  private pendingSubscription: Subscription | null = null;
  private pendingRequestId = 0;

  readonly eventForm = this.formBuilder.group({
    calendarId: ['', Validators.required],
    eventType: ['CLIENT' as EventType, Validators.required],
    // Obrigatoriedade validada após trim em submitEventForm (CLIENT usa o nome do cliente).
    title: ['', Validators.maxLength(180)],
    clientName: ['', Validators.maxLength(120)],
    personName: ['', Validators.maxLength(120)],
    description: [''],
    workDescription: [''],
    amount: [''],
    date: ['', Validators.required],
    startTime: ['', Validators.required],
    endTime: ['', Validators.required],
    approvalRequestedFromEmail: [''],
  });

  readonly paymentForm = this.formBuilder.group({
    paymentStatus: ['PENDING' as PaymentStatus, Validators.required],
    paymentMethod: ['' as PaymentMethod | ''],
    receivedAmount: [''],
    paidAt: [''],
  });

  readonly calendars = signal<CalendarResponse[]>([]);
  readonly selectedCalendarIds = signal<string[]>([]);
  readonly events = signal<EventResponse[]>([]);
  readonly pendingApprovals = signal<EventResponse[]>([]);
  readonly currentUser = this.authService.currentUser;

  readonly selectedEventTypes = signal<EventType[]>(['CLIENT', 'PERSONAL', 'SHARED']);
  readonly visibleStart = signal<Date | null>(null);
  readonly visibleEnd = signal<Date | null>(null);
  readonly isLoading = signal(false);
  readonly errorMessage = signal('');
  readonly readPendingIds = signal<Set<string>>(new Set());
  readonly openFilterMenu = signal<'calendars' | 'events' | null>(null);
  readonly currentCalendarView = signal<CalendarViewName>('dayGridMonth');
  readonly isPendingPanelCollapsed = signal(false);
  /** Título do período visível (ex.: "Novembro de 2026"), vindo do FullCalendar. */
  readonly periodTitle = signal('');

  readonly viewOptions: Array<{ value: CalendarViewName; label: string }> = [
    { value: 'dayGridMonth', label: 'Mês' },
    { value: 'timeGridWeek', label: 'Semana' },
    { value: 'timeGridDay', label: 'Dia' },
  ];

  readonly eventTypeCards: Array<{ value: EventType; label: string; hint: string; icon: IconName }> = [
    { value: 'CLIENT', label: 'Cliente', hint: 'Atendimento com valor', icon: 'briefcase' },
    { value: 'PERSONAL', label: 'Pessoal', hint: 'Compromisso pessoal', icon: 'calendar' },
    { value: 'SHARED', label: 'Compartilhado', hint: 'Requer aprovação', icon: 'users' },
  ];

  readonly durationOptions = [15, 30, 45, 60, 90, 120, 180];

  readonly financeSummary = signal<MonthlyFinanceSummary | null>(null);
  readonly isFinanceLoading = signal(false);
  readonly financeError = signal('');

  readonly eventTypeOptions: Array<{ value: EventType; label: string }> = [
    { value: 'CLIENT', label: 'Cliente' },
    { value: 'PERSONAL', label: 'Pessoal' },
    { value: 'SHARED', label: 'Compartilhado' },
  ];

  readonly paymentStatusOptions: Array<{ value: PaymentStatus; label: string }> = [
    { value: 'PENDING', label: 'Pendente' },
    { value: 'PARTIALLY_PAID', label: 'Pago parcialmente' },
    { value: 'PAID', label: 'Pago' },
    { value: 'REFUNDED', label: 'Estornado' },
  ];

  readonly paymentMethodOptions: Array<{ value: PaymentMethod; label: string }> = [
    { value: 'CASH', label: 'Dinheiro' },
    { value: 'PIX', label: 'PIX' },
    { value: 'CREDIT_CARD', label: 'Cartao de credito' },
    { value: 'DEBIT_CARD', label: 'Cartao de debito' },
    { value: 'BANK_TRANSFER', label: 'Transferencia' },
    { value: 'MERCADO_PAGO', label: 'Mercado Pago' },
    { value: 'OTHER', label: 'Outro' },
  ];

  private readonly CALENDAR_COLORS: Array<{ bg: string; text: string; border: string }> = [
    { bg: '#dbeafe', text: '#1d4ed8', border: '#3b82f6' },
    { bg: '#dcfce7', text: '#166534', border: '#22c55e' },
    { bg: '#ede9fe', text: '#6d28d9', border: '#8b5cf6' },
    { bg: '#fef3c7', text: '#92400e', border: '#f59e0b' },
    { bg: '#fee2e2', text: '#991b1b', border: '#ef4444' },
    { bg: '#e0f2fe', text: '#075985', border: '#0ea5e9' },
  ];

  private readonly AVATAR_COLORS: Array<{ bg: string; text: string }> = [
    { bg: '#dbeafe', text: '#1d4ed8' },
    { bg: '#dcfce7', text: '#166534' },
    { bg: '#ede9fe', text: '#6d28d9' },
    { bg: '#fef3c7', text: '#92400e' },
    { bg: '#fee2e2', text: '#991b1b' },
    { bg: '#e0f2fe', text: '#075985' },
  ];

  readonly calendarColorMap = computed(() => {
    const map = new Map<string, { bg: string; text: string; border: string }>();
    this.calendars().forEach((cal, i) => {
      map.set(cal.id, this.CALENDAR_COLORS[i % this.CALENDAR_COLORS.length]);
    });
    return map;
  });

  readonly visibleCalendarLegend = computed(() => {
    const selectedIds = new Set(this.selectedCalendarIds());

    return this.calendars().filter(calendar => selectedIds.has(calendar.id));
  });

  readonly creatableCalendars = computed(() =>
    this.calendars().filter(calendar => calendar.canCreateEvents),
  );

  readonly canCreateEvents = computed(() => this.creatableCalendars().length > 0);

  readonly filteredEvents = computed(() => {
    const selectedTypes = this.selectedEventTypes();

    return this.events().filter(event => selectedTypes.includes(event.eventType));
  });

  readonly pendingEvents = computed(() => this.pendingApprovals());

  readonly allEventTypesSelected = computed(() =>
    this.selectedEventTypes().length === this.eventTypeOptions.length,
  );

  /** Próximos eventos do período carregado (dados reais de /api/events), sem cancelados/rejeitados. */
  readonly upcomingEvents = computed(() => {
    const now = this.clock();

    return this.filteredEvents()
      .filter(event => event.status !== 'CANCELLED' && event.status !== 'REJECTED')
      .filter(event => new Date(event.endsAt).getTime() >= now)
      .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime())
      .slice(0, 4);
  });

  /** Calendários com capacidade financeira (BR-FIN-003); o backend continua autorizando. */
  readonly financeCalendars = computed(() =>
    financeAuthorizedCalendars(this.currentUser(), this.calendars()),
  );

  readonly financeDelta = computed(() => {
    const summary = this.financeSummary();

    if (!summary || summary.previousExpectedAmount <= 0) {
      return null;
    }

    return ((summary.expectedAmount - summary.previousExpectedAmount) / summary.previousExpectedAmount) * 100;
  });

  readonly unreadPendingCount = computed(() =>
    this.pendingEvents().filter(event => !this.isPendingRead(event.id)).length,
  );

  readonly canRespondToSelectedEvent = computed(() => {
    const event = this.selectedEvent();
    const currentUser = this.currentUser();

    return !!event
      && event.status === 'PENDING_APPROVAL'
      && !!event.approvalRequestedFromEmail
      && event.approvalRequestedFromEmail.toLowerCase() === currentUser?.email.toLowerCase();
  });

  readonly periodChip = computed(() => {
    const start = this.visibleStart();
    const end = this.visibleEnd();

    if (!start || !end) {
      return 'Período carregando';
    }

    const finalDate = new Date(end);
    finalDate.setDate(finalDate.getDate() - 1);

    return `${this.formatDate(start)} - ${this.formatDate(finalDate)}`;
  });

  readonly calendarChip = computed(() => {
    const total = this.calendars().length;
    const selected = this.selectedCalendarIds().length;

    if (!total) {
      return 'Nenhum';
    }

    if (selected === 0) {
      return 'Nenhum';
    }

    if (selected === total) {
      return 'Todos';
    }

    return `${selected} selecionado(s)`;
  });

  readonly eventsChip = computed(() => {
    const selected = this.selectedEventTypes().length;

    if (selected === 0) {
      return 'Nenhum';
    }

    if (selected === this.eventTypeOptions.length) {
      return 'Todos';
    }

    return `${selected} tipo(s)`;
  });

  calendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
    initialView: 'dayGridMonth',
    // Só as semanas do mês (4–6 linhas), sem a linha extra do mês seguinte.
    fixedWeekCount: false,
    locale: ptBrLocale,
    headerToolbar: false,
    allDaySlot: false,
    height: 'auto',
    slotMinTime: '00:00:00',
    slotMaxTime: '24:00:00',
    slotDuration: '01:00:00',
    scrollTime: '07:00:00',
    scrollTimeReset: false,
    eventDisplay: 'block',
    eventMinHeight: 58,
    eventShortHeight: 46,
    slotEventOverlap: false,
    eventOverlap: false,
    nowIndicator: true,
    editable: false,
    selectable: true,
    selectMirror: true,
    expandRows: false,
    dayHeaderFormat: { weekday: 'short', day: '2-digit', month: '2-digit' },
    views: {
      dayGridMonth: {
        dayHeaderFormat: { weekday: 'short' },
        eventDisplay: 'block',
        dayMaxEvents: 3,
      },
    },
    slotLabelFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
    datesSet: (arg) => this.onDatesSet(arg),
    dateClick: (arg) => this.openNewEventModal(arg.date),
    select: (arg) => this.openNewEventModal(arg.start, arg.end),
    eventClick: (arg) => this.openEventDetails(arg.event.extendedProps as EventResponse),
    eventContent: (arg) => this.renderCalendarEvent(arg.event.extendedProps as EventResponse, arg.view.type),
    events: [],
  };


  constructor() {
    effect(() => {
      this.calendarOptions = {
        ...this.calendarOptions,
        events: this.toCalendarEvents(this.filteredEvents()),
      };
    });

    effect(() => {
      const email = this.currentUser()?.email;
      this.readPendingIds.set(email ? this.loadReadPendingIds(email) : new Set());
    });

    effect(() => {
      const calendarIds = this.financeCalendars().map(calendar => calendar.id);
      // Mutações (evento, cancelamento, pagamento, aprovação) invalidam o resumo mensal.
      const version = this.dataChanges.version();
      untracked(() => this.loadFinanceSummary(calendarIds, version));
    });

    if (typeof window !== 'undefined') {
      this.clockTimerId = setInterval(() => this.clock.set(Date.now()), 60_000);
    }

    this.destroyRef.onDestroy(() => {
      this.financeSubscription?.unsubscribe();
      if (this.clockTimerId) {
        clearInterval(this.clockTimerId);
      }
    });
  }

  // ---- Redesign: filtros por tipo, período, duração e painéis ----------------------

  onTypeChip(eventType: EventType): void {
    // Com todos ativos, o chip isola o tipo; nos demais casos alterna, nunca deixando zero tipos.
    if (this.allEventTypesSelected()) {
      this.selectedEventTypes.set([eventType]);
      return;
    }

    this.toggleEventType(eventType);

    if (!this.selectedEventTypes().length) {
      this.selectAllEventTypes();
    }
  }

  isEventTypeActive(eventType: EventType): boolean {
    return !this.allEventTypesSelected() && this.selectedEventTypes().includes(eventType);
  }

  typeClass(eventType: EventType): string {
    return eventType.toLowerCase();
  }

  typeIcon(eventType: EventType): IconName {
    return this.eventTypeCards.find(card => card.value === eventType)?.icon ?? 'calendar';
  }

  displayTitle(event: EventResponse): string {
    return this.eventTitle(event);
  }

  formatTimeRange(event: EventResponse): string {
    return `${this.formatEventTime(new Date(event.startsAt))} – ${this.formatEventTime(new Date(event.endsAt))}`;
  }

  /** "Hoje", "Amanhã" ou a data curta, seguido do intervalo de horário. */
  formatUpcomingWhen(event: EventResponse): string {
    const start = new Date(event.startsAt);
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    const sameDay = (left: Date, right: Date) => left.toDateString() === right.toDateString();
    const day = sameDay(start, today)
      ? 'Hoje'
      : sameDay(start, tomorrow)
        ? 'Amanhã'
        : start.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });

    return `${day} · ${this.formatTimeRange(event)}`;
  }

  currentDurationMinutes(): number | null {
    const { startTime, endTime } = this.eventForm.getRawValue();
    const minutes = this.minutesBetween(startTime, endTime);
    return minutes !== null && this.durationOptions.includes(minutes) ? minutes : null;
  }

  onDurationChange(value: string): void {
    const minutes = Number(value);
    const startTime = this.eventForm.controls.startTime.value;

    if (!minutes || !startTime) {
      return;
    }

    const [hours, mins] = startTime.split(':').map(Number);
    const total = hours * 60 + mins + minutes;

    // Eventos que atravessam a meia-noite dependem de requisito próprio (BLG-UX-004):
    // não aplicamos uma duração diferente da escolhida.
    if (total > 23 * 60 + 59) {
      this.eventFormError.set('A duração escolhida ultrapassa 23:59. Ajuste o horário de término manualmente.');
      return;
    }

    this.eventFormError.set('');
    const pad = (part: number) => String(part).padStart(2, '0');
    this.eventForm.controls.endTime.setValue(`${pad(Math.floor(total / 60))}:${pad(total % 60)}`);
  }

  /** Durações que terminam até 23:59 no mesmo dia, dado o horário de início atual. */
  availableDurations(): number[] {
    const startTime = this.eventForm.controls.startTime.value;

    if (!startTime) {
      return this.durationOptions;
    }

    const [hours, mins] = startTime.split(':').map(Number);
    const startMinutes = hours * 60 + mins;
    return this.durationOptions.filter(minutes => startMinutes + minutes <= 23 * 60 + 59);
  }

  formatDuration(minutes: number): string {
    if (minutes < 60) {
      return `${minutes} min`;
    }

    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours}h ${rest}min` : `${hours}h`;
  }

  retryFinanceSummary(): void {
    this.financeRequestKey = '';
    this.loadFinanceSummary(this.financeCalendars().map(calendar => calendar.id));
  }

  financeBarWidth(value: number): number {
    const expected = this.financeSummary()?.expectedAmount ?? 0;
    return expected > 0 ? Math.min(100, Math.round((value / expected) * 100)) : 0;
  }

  private minutesBetween(startTime: string, endTime: string): number | null {
    if (!startTime || !endTime) {
      return null;
    }

    const toMinutes = (value: string) => {
      const [hours, minutes] = value.split(':').map(Number);
      return hours * 60 + minutes;
    };

    const diff = toMinutes(endTime) - toMinutes(startTime);
    return diff > 0 ? diff : null;
  }

  /** Mês civil atual vs. anterior, somando os calendários autorizados (sem valores fixos). */
  private loadFinanceSummary(calendarIds: string[], version = this.dataChanges.version()): void {
    const today = new Date();
    const key = `${calendarIds.join(',')}|${today.getFullYear()}-${today.getMonth()}|${version}`;

    if (key === this.financeRequestKey) {
      return;
    }

    this.financeRequestKey = key;
    this.financeSubscription?.unsubscribe();

    if (!calendarIds.length) {
      this.financeSummary.set(null);
      this.isFinanceLoading.set(false);
      this.financeError.set('');
      return;
    }

    const toIso = (date: Date) => this.toInputDate(date);
    const currentStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const currentEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const previousStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const previousEnd = new Date(today.getFullYear(), today.getMonth(), 0);

    this.isFinanceLoading.set(true);
    this.financeError.set('');

    const requests = calendarIds.flatMap(calendarId => [
      this.financeService.summarize(calendarId, toIso(currentStart), toIso(currentEnd)),
      this.financeService.summarize(calendarId, toIso(previousStart), toIso(previousEnd)),
    ]);

    this.financeSubscription = forkJoin(requests).subscribe({
      next: results => {
        const current = results.filter((_, index) => index % 2 === 0);
        const previous = results.filter((_, index) => index % 2 === 1);
        const sum = (items: typeof results, pick: (item: (typeof results)[number]) => number) =>
          items.reduce((total, item) => total + (Number(pick(item)) || 0), 0);
        const monthLabel = currentStart.toLocaleDateString('pt-BR', { month: 'long' });

        this.financeSummary.set({
          monthLabel,
          expectedAmount: sum(current, item => item.expectedAmount),
          receivedAmount: sum(current, item => item.receivedAmount),
          pendingAmount: sum(current, item => item.pendingAmount),
          appointmentCount: sum(current, item => item.appointmentCount),
          previousExpectedAmount: sum(previous, item => item.expectedAmount),
        });
        this.isFinanceLoading.set(false);
      },
      error: () => {
        this.financeSummary.set(null);
        this.financeError.set('Não foi possível carregar o resumo financeiro.');
        this.isFinanceLoading.set(false);
      },
    });
  }

  ngOnInit(): void {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const eventId = params.get('eventId');
        const date = params.get('date');

        if (!eventId || !date) {
          return;
        }

        this.pendingSearchTarget = {
          eventId,
          date,
          calendarId: params.get('calendarId') ?? '',
        };
        this.openSearchTarget();
      });

    this.paymentForm.controls.paymentStatus.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(status => this.applyPaymentStatusDefaults(status));

    this.loadPendingApprovals();
    this.loadCalendars();
  }

  ngAfterViewInit(): void {
    this.openSearchTarget();
  }

  toggleFilterMenu(filterMenu: 'calendars' | 'events'): void {
    this.openFilterMenu.set(this.openFilterMenu() === filterMenu ? null : filterMenu);
  }

  closeFilterMenu(): void {
    this.openFilterMenu.set(null);
  }

  toggleCalendar(calendarId: string): void {
    const selected = this.selectedCalendarIds();

    if (selected.includes(calendarId)) {
      this.selectedCalendarIds.set(selected.filter(id => id !== calendarId));
    } else {
      this.selectedCalendarIds.set([...selected, calendarId]);
    }

    this.loadEvents();
  }

  selectAllCalendars(): void {
    this.selectedCalendarIds.set(this.calendars().map(calendar => calendar.id));
    this.loadEvents();
  }

  clearCalendarFilter(event?: MouseEvent): void {
    event?.stopPropagation();
    this.selectAllCalendars();
    this.closeFilterMenu();
  }

  toggleEventType(eventType: EventType): void {
    const selected = this.selectedEventTypes();

    if (selected.includes(eventType)) {
      this.selectedEventTypes.set(selected.filter(type => type !== eventType));
    } else {
      this.selectedEventTypes.set([...selected, eventType]);
    }
  }

  selectAllEventTypes(): void {
    this.selectedEventTypes.set(this.eventTypeOptions.map(option => option.value));
  }

  clearEventTypeFilter(event?: MouseEvent): void {
    event?.stopPropagation();
    this.selectAllEventTypes();
    this.closeFilterMenu();
  }

  resetPeriodFilter(event?: MouseEvent): void {
    event?.stopPropagation();
    this.closeFilterMenu();
    this.calendarComponent?.getApi().today();
  }

  clearFilters(): void {
    this.searchService.clear();
    this.selectedCalendarIds.set(this.calendars().map(calendar => calendar.id));
    this.selectAllEventTypes();
    this.closeFilterMenu();
    this.calendarComponent?.getApi().today();
    this.loadEvents();
  }

  changeView(viewName: string): void {
    const nextView = this.toCalendarViewName(viewName);
    this.currentCalendarView.set(nextView);

    const calendarApi = this.calendarComponent?.getApi();
    calendarApi?.setOption('height', nextView === 'dayGridMonth' ? 'auto' : '100%');
    calendarApi?.changeView(nextView);
  }

  prevPeriod(): void {
    this.calendarComponent?.getApi().prev();
  }

  nextPeriod(): void {
    this.calendarComponent?.getApi().next();
  }

  goToToday(): void {
    this.calendarComponent?.getApi().today();
  }

  markAllAsRead(): void {
    const ids = new Set(this.readPendingIds());

    this.pendingEvents().forEach(event => ids.add(event.id));
    this.readPendingIds.set(ids);
    this.saveReadPendingIds(ids);
  }

  togglePendingPanel(): void {
    this.isPendingPanelCollapsed.set(!this.isPendingPanelCollapsed());
  }

  openPendingPage(): void {
    this.router.navigate(['/pending']);
  }

  openFinancePage(): void {
    this.router.navigate(['/finance']);
  }

  openEventDetails(event: EventResponse): void {
    this.eventDetailError.set('');
    this.paymentFormError.set('');
    this.isPaymentFormOpen.set(false);
    this.resetPaymentForm(event);
    this.selectedEvent.set(event);
  }

  closeEventDetails(): void {
    if (this.isDeletingEvent() || this.isUpdatingApproval() || this.isUpdatingPayment()) {
      return;
    }

    this.eventDetailError.set('');
    this.paymentFormError.set('');
    this.isPaymentFormOpen.set(false);
    this.selectedEvent.set(null);
  }

  openNewEventModal(start?: Date, end?: Date): void {
    const startsAt = start ?? new Date();
    const endsAt = end ?? this.addMinutes(startsAt, 60);
    const calendarId = this.defaultEventCalendarId();

    if (!calendarId) {
      this.errorMessage.set('Você não tem permissão para criar eventos nos calendários selecionados.');
      return;
    }

    this.formEventType.set('CLIENT');
    this.eventFormError.set('');
    this.eventDetailError.set('');
    this.isEditMode.set(false);
    this.eventBeingEdited.set(null);

    this.eventForm.reset({
      calendarId,
      eventType: 'CLIENT',
      title: '',
      clientName: '',
      personName: '',
      description: '',
      workDescription: '',
      amount: '',
      date: this.toInputDate(startsAt),
      startTime: this.toInputTime(startsAt),
      endTime: this.toInputTime(endsAt),
      approvalRequestedFromEmail: '',
    });

    this.isEventModalOpen.set(true);
    this.calendarComponent?.getApi().unselect();
  }

  openEditEventModal(event: EventResponse): void {
    const startsAt = new Date(event.startsAt);
    const endsAt = new Date(event.endsAt);

    this.selectedEvent.set(null);
    this.eventDetailError.set('');
    this.eventFormError.set('');
    this.isEditMode.set(true);
    this.eventBeingEdited.set(event);
    this.formEventType.set(event.eventType);

    this.eventForm.reset({
      calendarId: event.calendarId,
      eventType: event.eventType,
      title: event.title,
      clientName: event.clientName ?? '',
      personName: event.personName ?? '',
      description: event.description ?? '',
      workDescription: event.workDescription ?? '',
      amount: event.amount == null ? '' : String(event.amount),
      date: this.toInputDate(startsAt),
      startTime: this.toInputTime(startsAt),
      endTime: this.toInputTime(endsAt),
      approvalRequestedFromEmail: event.approvalRequestedFromEmail ?? '',
    });

    this.isEventModalOpen.set(true);
  }

  closeEventModal(): void {
    if (this.isSavingEvent()) {
      return;
    }

    this.isEventModalOpen.set(false);
    this.eventFormError.set('');
    this.isEditMode.set(false);
    this.eventBeingEdited.set(null);
  }

  onEventTypeChange(eventType: EventType): void {
    this.formEventType.set(eventType);
    this.eventForm.controls.eventType.setValue(eventType);
  }

  submitEventForm(): void {
    this.eventFormError.set('');

    if (this.eventForm.invalid) {
      this.eventForm.markAllAsTouched();
      this.eventFormError.set(
        this.eventBeingEdited()
          ? 'Preencha os campos obrigatórios para salvar o evento.'
          : 'Preencha os campos obrigatórios para criar o evento.',
      );
      return;
    }

    const raw = this.eventForm.getRawValue();
    const calendarId = this.cleanText(raw.calendarId);
    const eventType = raw.eventType;
    const clientName = this.cleanText(raw.clientName);
    // CLIENT não exibe "título" no formulário: usa o título existente ou o nome do cliente.
    const title = this.cleanText(raw.title) || (eventType === 'CLIENT' ? clientName : '');
    const personName = this.cleanText(raw.personName);
    const description = this.cleanText(raw.description);
    const workDescription = this.cleanText(raw.workDescription);
    const approvalRequestedFromEmail = this.cleanText(raw.approvalRequestedFromEmail);

    if (!calendarId) {
      this.eventFormError.set('Selecione o calendário do evento.');
      return;
    }

    if (!this.canCreateInCalendar(calendarId)) {
      this.eventFormError.set('Você não tem permissão para criar eventos neste calendário.');
      return;
    }

    if (eventType === 'CLIENT' && !clientName) {
      this.eventFormError.set('Informe o nome do cliente.');
      return;
    }

    // BLG-FE-007: o título é validado depois do trim (Validators.required aceita só espaços).
    if (!title) {
      this.eventFormError.set('Informe o título do evento.');
      return;
    }

    // BR-CLIENT-001: CLIENT exige descrição do serviço, como o backend.
    if (eventType === 'CLIENT' && !workDescription) {
      this.eventFormError.set('Informe a descrição do serviço do atendimento.');
      return;
    }

    if (eventType === 'PERSONAL' && !personName) {
      this.eventFormError.set('Informe o nome da pessoa.');
      return;
    }

    if (eventType === 'SHARED' && !approvalRequestedFromEmail) {
      this.eventFormError.set('Informe o e-mail do usuário responsável pela aprovação.');
      return;
    }

    if (eventType === 'SHARED' && !CalendarPage.EMAIL_PATTERN.test(approvalRequestedFromEmail)) {
      this.eventFormError.set('Informe um e-mail válido para a aprovação.');
      return;
    }

    if (
      eventType === 'SHARED'
      && approvalRequestedFromEmail.toLowerCase() === this.currentUser()?.email.toLowerCase()
    ) {
      this.eventFormError.set('A aprovação deve ser solicitada a outro usuário.');
      return;
    }

    const startsAt = this.buildLocalDateTime(raw.date, raw.startTime);
    const endsAt = this.buildLocalDateTime(raw.date, raw.endTime);

    if (endsAt <= startsAt) {
      this.eventFormError.set('O horário final deve ser maior que o horário inicial.');
      return;
    }

    const amount = eventType === 'CLIENT' ? this.parseAmount(raw.amount) : null;

    if (eventType === 'CLIENT' && amount === null) {
      this.eventFormError.set('Informe um valor valido para o evento de cliente.');
      return;
    }

    const request: UpdateEventRequest = {
      eventType,
      title,
      clientName: eventType === 'CLIENT' ? clientName : null,
      personName: eventType === 'PERSONAL' ? personName : null,
      description: description || null,
      workDescription: eventType === 'CLIENT' ? workDescription || null : null,
      amount,
      startsAt: this.toLocalDateTime(startsAt),
      endsAt: this.toLocalDateTime(endsAt),
      approvalRequestedFromEmail:
        eventType === 'SHARED' ? approvalRequestedFromEmail : null,
    };

    this.isSavingEvent.set(true);
    const editedEvent = this.eventBeingEdited();
    const saveRequest = editedEvent
      ? this.eventService.update(editedEvent.id, request)
      : this.eventService.create({ calendarId, ...request } as CreateEventRequest);

    saveRequest
      .pipe(finalize(() => this.isSavingEvent.set(false)))
      .subscribe({
        next: () => {
          if (!this.selectedCalendarIds().includes(calendarId)) {
            this.selectedCalendarIds.set([...this.selectedCalendarIds(), calendarId]);
          }

          if (!this.selectedEventTypes().includes(eventType)) {
            this.selectedEventTypes.set([...this.selectedEventTypes(), eventType]);
          }

          this.isEventModalOpen.set(false);
          this.isEditMode.set(false);
          this.eventBeingEdited.set(null);
          this.loadEvents();
          this.loadPendingApprovals();
          this.dataChanges.notify();
        },
        error: (error) => {
          this.eventFormError.set(
            this.extractErrorMessage(error, 'Não foi possível salvar o evento. Verifique os dados e tente novamente.'),
          );
        },
      });
  }

  deleteSelectedEvent(): void {
    const event = this.selectedEvent();

    if (!event) {
      return;
    }

    const confirmed = window.confirm(`Deseja cancelar/desmarcar o evento "${event.title}"?`);

    if (!confirmed) {
      return;
    }

    this.eventDetailError.set('');
    this.isDeletingEvent.set(true);

    this.eventService
      .delete(event.id)
      .pipe(finalize(() => this.isDeletingEvent.set(false)))
      .subscribe({
        next: () => {
          this.selectedEvent.set(null);
          this.loadEvents();
          this.loadPendingApprovals();
          this.dataChanges.notify();
        },
        error: (error) => {
          this.eventDetailError.set(
            this.extractErrorMessage(error, 'Não foi possível cancelar/desmarcar este evento.'),
          );
        },
      });
  }

  approveSelectedEvent(): void {
    this.respondToSelectedEvent('approve');
  }

  approvePendingEvent(event: EventResponse, mouseEvent: MouseEvent): void {
    mouseEvent.stopPropagation();
    this.respondToEvent(event, 'approve');
  }

  rejectSelectedEvent(): void {
    const event = this.selectedEvent();

    if (!event) {
      return;
    }

    const confirmed = window.confirm(`Deseja reprovar o evento "${event.title}"?`);

    if (!confirmed) {
      return;
    }

    this.respondToSelectedEvent('reject');
  }

  rejectPendingEvent(event: EventResponse, mouseEvent: MouseEvent): void {
    mouseEvent.stopPropagation();

    const confirmed = window.confirm(`Deseja reprovar o evento "${event.title}"?`);

    if (!confirmed) {
      return;
    }

    this.respondToEvent(event, 'reject');
  }

  togglePaymentForm(event: EventResponse): void {
    this.paymentFormError.set('');

    if (event.eventType !== 'CLIENT' || !this.hasFinancialDetails(event) || !this.canEditEvent(event)) {
      this.isPaymentFormOpen.set(false);
      return;
    }

    const shouldOpen = !this.isPaymentFormOpen();

    if (shouldOpen) {
      this.resetPaymentForm(event);
    }

    this.isPaymentFormOpen.set(shouldOpen);
  }

  submitPaymentForm(): void {
    const event = this.selectedEvent();

    if (
      !event
      || event.eventType !== 'CLIENT'
      || !this.hasFinancialDetails(event)
      || !this.canEditEvent(event)
    ) {
      return;
    }

    this.paymentFormError.set('');

    if (this.paymentForm.invalid) {
      this.paymentForm.markAllAsTouched();
      this.paymentFormError.set('Informe o status do pagamento.');
      return;
    }

    const raw = this.paymentForm.getRawValue();
    const receivedAmount = this.parseAmount(raw.receivedAmount);
    const paidAt = this.cleanText(raw.paidAt);

    const request: UpdatePaymentRequest = {
      paymentStatus: raw.paymentStatus,
      paymentMethod: raw.paymentMethod || null,
      receivedAmount,
      paidAt: paidAt ? `${paidAt}:00` : null,
    };

    const validationMessage = this.validatePaymentForm(event, request);

    if (validationMessage) {
      this.paymentFormError.set(validationMessage);
      return;
    }

    this.isUpdatingPayment.set(true);

    this.eventService
      .updatePayment(event.id, request)
      .pipe(finalize(() => this.isUpdatingPayment.set(false)))
      .subscribe({
        next: updatedEvent => {
          this.updateEventInState(updatedEvent);
          this.selectedEvent.set(updatedEvent);
          this.resetPaymentForm(updatedEvent);
          this.isPaymentFormOpen.set(false);
          this.dataChanges.notify();
        },
        error: error => {
          this.paymentFormError.set(
            this.extractErrorMessage(error, 'Não foi possível atualizar o pagamento deste evento.'),
          );
        },
      });
  }

  calendarName(calendarId: string): string {
    return this.calendars().find(calendar => calendar.id === calendarId)?.name ?? 'Calendário';
  }

  eventTypeLabel(eventType: EventType): string {
    return this.eventTypeOptions.find(option => option.value === eventType)?.label ?? eventType;
  }

  eventStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      SCHEDULED: 'Agendado',
      PENDING_APPROVAL: 'Pendente de aprovação',
      APPROVED: 'Aprovado',
      REJECTED: 'Reprovado',
      CANCELLED: 'Cancelado',
    };

    return labels[status] ?? status;
  }

  paymentStatusLabel(status: PaymentStatus | null | undefined): string {
    if (!status) {
      return 'Não informado';
    }

    return this.paymentStatusOptions.find(option => option.value === status)?.label ?? status;
  }

  paymentMethodLabel(method: PaymentMethod | null | undefined): string {
    if (!method) {
      return 'Não informado';
    }

    return this.paymentMethodOptions.find(option => option.value === method)?.label ?? method;
  }

  paymentFormHint(): string {
    const status = this.paymentForm.controls.paymentStatus.value;
    const event = this.selectedEvent();
    const amount = event?.amount ?? null;
    const amountText = amount === null ? 'o valor total do evento' : this.formatMoney(amount);

    if (status === 'PAID') {
      return `Ao marcar como pago, o valor recebido deve ser ${amountText}. Informe tambem a forma de pagamento.`;
    }

    if (status === 'PARTIALLY_PAID') {
      return `Para pagamento parcial, informe um valor maior que zero e menor que ${amountText}.`;
    }

    if (status === 'REFUNDED') {
      return 'Para estorno, mantenha o valor recebido zerado.';
    }

    return 'Pagamento pendente deve ficar sem valor recebido e sem data de pagamento.';
  }

  isPaymentMethodRequired(): boolean {
    const status = this.paymentForm.controls.paymentStatus.value;

    return status === 'PAID' || status === 'PARTIALLY_PAID';
  }

  isReceivedAmountReadOnly(): boolean {
    const status = this.paymentForm.controls.paymentStatus.value;

    return status === 'PENDING' || status === 'REFUNDED';
  }

  canRespondToEvent(event: EventResponse): boolean {
    const currentUser = this.currentUser();

    return !!currentUser
      && event.status === 'PENDING_APPROVAL'
      && !!event.approvalRequestedFromEmail
      && event.approvalRequestedFromEmail.toLowerCase() === currentUser.email.toLowerCase();
  }

  isPendingRead(eventId: string): boolean {
    return this.readPendingIds().has(eventId);
  }

  formatDateTime(value: string): string {
    return new Date(value).toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  }

  /** Responsável exibido no cabeçalho: pessoa (PERSONAL) ou quem criou o evento. */
  responsibleLabel(event: EventResponse): string {
    return event.personName ? `Responsável: ${event.personName}` : `Responsável: ${event.createdByEmail}`;
  }

  formatDayLong(value: string): string {
    return new Date(value).toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  durationLabel(event: EventResponse): string {
    const minutes = Math.round((new Date(event.endsAt).getTime() - new Date(event.startsAt).getTime()) / 60000);
    return minutes > 0 ? this.formatDuration(minutes) : '—';
  }

  pendingAmount(event: EventResponse): number | null {
    if (event.amount == null) {
      return null;
    }

    return Math.max(0, Number(event.amount) - Number(event.receivedAmount ?? 0));
  }

  /** Confirmação/desmarcação/remarcação concluída: atualiza modal, calendário e indicadores. */
  onAppointmentUpdated(updated: EventResponse): void {
    const moved = this.selectedEvent()?.startsAt !== updated.startsAt;
    this.updateEventInState(updated);
    this.selectedEvent.set(updated);
    this.dataChanges.notify();

    // Remarcação pode levar o atendimento para fora do período exibido.
    if (moved) {
      this.loadEvents();
    }
  }

  formatMoney(value: number | null | undefined): string {
    if (value == null) {
      return '-';
    }

    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  }

  canEditEvent(event: EventResponse): boolean {
    if (event.status === 'CANCELLED') {
      return false;
    }

    const currentUser = this.currentUser();

    if (!currentUser) {
      return false;
    }

    if (currentUser.role === 'ADMIN') {
      return true;
    }

    const calendar = this.calendars().find(currentCalendar => currentCalendar.id === event.calendarId);

    if (!calendar?.memberRole) {
      return false;
    }

    if (calendar.memberRole === 'ADMIN') {
      return true;
    }

    if (calendar.memberRole === 'EDITOR'
        && event.createdByEmail.toLowerCase() === currentUser.email.toLowerCase()) {
      return true;
    }

    return event.eventType === 'SHARED'
      && calendar.canCreateEvents
      && event.approvalRequestedFromEmail?.toLowerCase() === currentUser.email.toLowerCase();
  }

  hasFinancialDetails(event: EventResponse): boolean {
    return Object.prototype.hasOwnProperty.call(event, 'amount')
      && Object.prototype.hasOwnProperty.call(event, 'paymentStatus')
      && Object.prototype.hasOwnProperty.call(event, 'receivedAmount');
  }

  private defaultEventCalendarId(): string {
    const selectedIds = new Set(this.selectedCalendarIds());

    return this.creatableCalendars().find(calendar => selectedIds.has(calendar.id))?.id
      ?? this.creatableCalendars()[0]?.id
      ?? '';
  }

  private canCreateInCalendar(calendarId: string): boolean {
    return this.calendars().some(calendar => calendar.id === calendarId && calendar.canCreateEvents);
  }

  private buildLocalDateTime(date: string, time: string): Date {
    return new Date(`${date}T${time}:00`);
  }

  private toInputDate(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, '0');

    return [
      date.getFullYear(),
      '-',
      pad(date.getMonth() + 1),
      '-',
      pad(date.getDate()),
    ].join('');
  }

  private toInputTime(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, '0');

    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  private toInputDateTime(date: Date): string {
    return `${this.toInputDate(date)}T${this.toInputTime(date)}`;
  }

  private nowInputDateTime(): string {
    return this.toInputDateTime(new Date());
  }

  private addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60 * 1000);
  }

  private cleanText(value: unknown): string {
    return String(value ?? '').trim();
  }

  private parseAmount(value: unknown): number | null {
    const normalized = String(value ?? '').replace(',', '.').trim();

    if (!normalized) {
      return null;
    }

    const amount = Number(normalized);

    return Number.isFinite(amount) ? amount : null;
  }

  private formatAmountForInput(amount: number): string {
    return amount.toFixed(2);
  }

  private sameAmount(left: number, right: number): boolean {
    return Math.round(left * 100) === Math.round(right * 100);
  }

  private applyPaymentStatusDefaults(status: PaymentStatus): void {
    const event = this.selectedEvent();
    const controls = this.paymentForm.controls;
    const patch: Partial<{
      paymentMethod: PaymentMethod | '';
      receivedAmount: string;
      paidAt: string;
    }> = {};

    if (status === 'PAID') {
      if (event?.amount !== null && event?.amount !== undefined) {
        patch.receivedAmount = this.formatAmountForInput(event.amount);
      }

      if (!this.cleanText(controls.paidAt.value)) {
        patch.paidAt = this.nowInputDateTime();
      }
    }

    if (status === 'PARTIALLY_PAID') {
      const currentAmount = this.parseAmount(controls.receivedAmount.value);

      if (
        event?.amount !== null
        && event?.amount !== undefined
        && currentAmount !== null
        && this.sameAmount(currentAmount, event.amount)
      ) {
        patch.receivedAmount = '';
      }

      if (!this.cleanText(controls.paidAt.value)) {
        patch.paidAt = this.nowInputDateTime();
      }
    }

    if (status === 'PENDING' || status === 'REFUNDED') {
      patch.paymentMethod = '';
      patch.receivedAmount = '';
      patch.paidAt = '';
    }

    if (Object.keys(patch).length) {
      this.paymentForm.patchValue(patch, { emitEvent: false });
    }

    this.paymentFormError.set('');
  }

  private validatePaymentForm(event: EventResponse, request: UpdatePaymentRequest): string | null {
    const receivedAmount = request.receivedAmount ?? 0;
    const eventAmount = event.amount;

    if (request.paymentStatus === 'PAID') {
      if (eventAmount == null) {
        return 'Informe o valor total do evento antes de marcar como pago.';
      }

      if (!request.paymentMethod) {
        return 'Informe a forma de pagamento para marcar como pago.';
      }

      if (!this.sameAmount(receivedAmount, eventAmount)) {
        return `Para marcar como pago, o valor recebido deve ser ${this.formatMoney(eventAmount)}.`;
      }
    }

    if (request.paymentStatus === 'PARTIALLY_PAID') {
      if (eventAmount == null) {
        return 'Informe o valor total do evento antes de marcar como pago parcialmente.';
      }

      if (!request.paymentMethod) {
        return 'Informe a forma de pagamento para pagamento parcial.';
      }

      if (receivedAmount <= 0 || receivedAmount >= eventAmount) {
        return `O pagamento parcial precisa ser maior que zero e menor que ${this.formatMoney(eventAmount)}.`;
      }
    }

    if (request.paymentStatus === 'PENDING') {
      if (receivedAmount > 0) {
        return 'Pagamento pendente não pode ter valor recebido.';
      }

      if (request.paidAt) {
        return 'Pagamento pendente não pode ter data de pagamento.';
      }
    }

    if (request.paymentStatus === 'REFUNDED' && receivedAmount > 0) {
      return 'Pagamento estornado não pode manter valor recebido.';
    }

    return null;
  }

  private extractErrorMessage(error: unknown, fallbackMessage: string): string {
    const httpError = error as { status?: number; error?: unknown };

    if (httpError.error && typeof httpError.error === 'object') {
      const body = httpError.error as {
        detail?: string;
        message?: string;
        error?: string;
      };

      const message = body.detail ?? body.message ?? body.error;

      if (message) {
        return message;
      }
    }

    if (typeof httpError.error === 'string' && httpError.error.trim()) {
      return httpError.error;
    }

    if (httpError.status === 403) {
      return 'Você não tem permissão para executar esta ação neste calendário.';
    }

    if (httpError.status === 400) {
      return 'Dados invalidos. Revise os campos obrigatorios do evento.';
    }

    if (httpError.status === 404) {
      return 'Calendário ou usuário informado não foi encontrado.';
    }

    return fallbackMessage;
  }

  private loadCalendars(): void {
    this.errorMessage.set('');

    this.calendarService.list().subscribe({
      next: calendars => {
        this.calendars.set(calendars);
        this.selectedCalendarIds.set(calendars.map(calendar => calendar.id));
        this.loadEvents();
        this.openSearchTarget();
      },
      error: () => {
        this.errorMessage.set('Não foi possível carregar os calendários.');
      },
    });
  }

  retryLoadEvents(): void {
    this.loadEvents();
  }

  retryLoadPendingApprovals(): void {
    this.loadPendingApprovals();
  }

  isPendingActionInProgress(eventId: string): boolean {
    return this.pendingActionEventIds().has(eventId);
  }

  /**
   * BLG-BUG-004/005: cada carga invalida e cancela a anterior (latest-wins), o loading
   * reflete somente a carga ativa e falhas por calendário são expostas, não viram [].
   */
  private loadEvents(): void {
    const start = this.visibleStart();
    const end = this.visibleEnd();
    const calendarIds = this.selectedCalendarIds();
    const requestId = ++this.eventsRequestId;

    this.eventsSubscription?.unsubscribe();
    this.eventsSubscription = null;

    if (!start || !end || !calendarIds.length) {
      this.events.set([]);
      this.eventsLoadError.set('');
      this.isLoading.set(false);
      return;
    }

    this.isLoading.set(true);
    this.eventsLoadError.set('');

    const requests = calendarIds.map(calendarId =>
      this.eventService
        .list(calendarId, this.toLocalDateTime(start), this.toLocalDateTime(end))
        .pipe(
          map(events => ({ calendarId, events, failed: false })),
          catchError(() => of({ calendarId, events: [] as EventResponse[], failed: true })),
        ),
    );

    this.eventsSubscription = forkJoin(requests).subscribe(results => {
      if (requestId !== this.eventsRequestId) {
        return;
      }

      const failedIds = results.filter(result => result.failed).map(result => result.calendarId);

      this.events.set(results.flatMap(result => result.events));
      this.isLoading.set(false);

      if (failedIds.length === results.length) {
        this.eventsLoadError.set('Não foi possível carregar os eventos. A agenda exibida pode estar incompleta.');
      } else if (failedIds.length) {
        const names = failedIds
          .map(id => this.calendars().find(calendar => calendar.id === id)?.name ?? id)
          .join(', ');
        this.eventsLoadError.set(`Não foi possível carregar os eventos de: ${names}. Os demais calendários foram carregados.`);
      }
    });
  }

  private loadPendingApprovals(): void {
    const requestId = ++this.pendingRequestId;

    this.pendingSubscription?.unsubscribe();
    this.isPendingLoading.set(true);
    this.pendingLoadError.set('');

    this.pendingSubscription = this.eventService.listPendingApprovals().subscribe({
      next: events => {
        if (requestId !== this.pendingRequestId) {
          return;
        }

        this.pendingApprovals.set(events);
        this.isPendingLoading.set(false);
      },
      error: () => {
        if (requestId !== this.pendingRequestId) {
          return;
        }

        // Mantém a última lista conhecida e sinaliza a falha em vez de afirmar "sem pendências".
        this.pendingLoadError.set('Não foi possível carregar as pendências.');
        this.isPendingLoading.set(false);
      },
    });
  }

  private setPendingActionInProgress(eventId: string, inProgress: boolean): void {
    this.pendingActionEventIds.update(current => {
      const next = new Set(current);

      if (inProgress) {
        next.add(eventId);
      } else {
        next.delete(eventId);
      }

      return next;
    });
  }

  private respondToSelectedEvent(action: 'approve' | 'reject'): void {
    const event = this.selectedEvent();

    if (!event || !this.canRespondToSelectedEvent()) {
      return;
    }

    this.eventDetailError.set('');
    this.isUpdatingApproval.set(true);

    this.respondToEvent(event, action, () => this.isUpdatingApproval.set(false));
  }

  private respondToEvent(
    event: EventResponse,
    action: 'approve' | 'reject',
    onDone?: () => void,
  ): void {
    if (!this.canRespondToEvent(event) || this.isPendingActionInProgress(event.id)) {
      onDone?.();
      return;
    }

    this.setPendingActionInProgress(event.id, true);

    const request = action === 'approve'
      ? this.eventService.approve(event.id)
      : this.eventService.reject(event.id);

    request
      .pipe(finalize(() => {
        this.setPendingActionInProgress(event.id, false);
        onDone?.();
      }))
      .subscribe({
        next: updatedEvent => {
          this.updateEventInState(updatedEvent);
          this.pendingApprovals.update(events =>
            events.filter(currentEvent => currentEvent.id !== updatedEvent.id),
          );

          if (this.selectedEvent()?.id === updatedEvent.id) {
            this.selectedEvent.set(updatedEvent);
          }

          this.loadPendingApprovals();
          this.dataChanges.notify();
        },
        error: error => {
          const fallback = action === 'approve'
            ? 'Não foi possível aprovar este evento.'
            : 'Não foi possível reprovar este evento.';

          const message = this.extractErrorMessage(error, fallback);

          if (this.selectedEvent()?.id === event.id) {
            this.eventDetailError.set(message);
          } else {
            this.errorMessage.set(message);
          }
        },
      });
  }

  private updateEventInState(updatedEvent: EventResponse): void {
    this.events.update(events =>
      events.map(currentEvent =>
        currentEvent.id === updatedEvent.id ? updatedEvent : currentEvent,
      ),
    );
  }

  private resetPaymentForm(event: EventResponse): void {
    this.paymentForm.reset({
      paymentStatus: event.paymentStatus ?? 'PENDING',
      paymentMethod: event.paymentMethod ?? '',
      receivedAmount: event.receivedAmount == null ? '' : String(event.receivedAmount),
      paidAt: event.paidAt ? this.toInputDateTime(new Date(event.paidAt)) : '',
    }, { emitEvent: false });
  }

  private openSearchTarget(): void {
    const target = this.pendingSearchTarget;

    if (!target || !this.calendarComponent || !this.calendars().length) {
      return;
    }

    this.pendingSearchTarget = null;

    if (target.calendarId && this.calendars().some(calendar => calendar.id === target.calendarId)) {
      const selectedIds = this.selectedCalendarIds();

      if (!selectedIds.includes(target.calendarId)) {
        this.selectedCalendarIds.set([...selectedIds, target.calendarId]);
      }
    }

    this.calendarComponent.getApi().gotoDate(target.date);
    this.eventDetailError.set('');

    this.eventService.findById(target.eventId).subscribe({
      next: event => {
        if (!this.selectedCalendarIds().includes(event.calendarId)) {
          this.selectedCalendarIds.set([...this.selectedCalendarIds(), event.calendarId]);
        }

        if (!this.selectedEventTypes().includes(event.eventType)) {
          this.selectedEventTypes.set([...this.selectedEventTypes(), event.eventType]);
        }

        this.selectedEvent.set(event);
        this.loadEvents();
      },
      error: () => {
        this.errorMessage.set('Não foi possível abrir o evento encontrado.');
      },
    });
  }

  private onDatesSet(arg: DatesSetArg): void {
    this.currentCalendarView.set(this.toCalendarViewName(arg.view.type));
    const title = arg.view.title ?? '';
    this.periodTitle.set(title.charAt(0).toUpperCase() + title.slice(1));
    this.visibleStart.set(arg.start);
    this.visibleEnd.set(arg.end);
    this.loadEvents();
  }

  private toCalendarViewName(viewName: string): CalendarViewName {
    if (viewName === 'timeGridWeek' || viewName === 'timeGridDay') {
      return viewName;
    }

    return 'dayGridMonth';
  }

  private toCalendarEvents(events: EventResponse[]): EventInput[] {
    // Cor por tipo de evento (design system); pendente/rejeitado/cancelado sobrepõem o tipo.
    return events.map(event => ({
      id: event.id,
      title: this.eventTitle(event),
      start: event.startsAt,
      end: event.endsAt,
      display: 'block',
      classNames: [
        'sp-event-block',
        `sp-type-${this.typeClass(event.eventType)}`,
        event.status === 'PENDING_APPROVAL' ? 'sp-event-pending' : '',
        event.status === 'REJECTED' ? 'sp-event-rejected' : '',
        event.status === 'CANCELLED' ? 'sp-event-cancelled' : '',
      ].filter(Boolean),
      extendedProps: event,
    }));
  }

  private eventTitle(event: EventResponse): string {
    if (event.eventType === 'CLIENT') {
      return event.clientName || event.title || 'Cliente';
    }

    if (event.eventType === 'PERSONAL') {
      return event.personName || event.title || 'Pessoal';
    }

    return event.title || 'Compartilhado';
  }

  private renderCalendarEvent(event: EventResponse, viewType: string): { html: string } {
    const startsAt = new Date(event.startsAt);
    const endsAt = new Date(event.endsAt);
    const time = `${this.formatEventTime(startsAt)} - ${this.formatEventTime(endsAt)}`;
    const title = this.escapeHtml(this.eventTitle(event));

    const status = event.status === 'PENDING_APPROVAL'
      ? '<span class="sp-event-status">Aguardando aprovação</span>'
      : '';

    if (viewType === 'dayGridMonth') {
      return {
        html: `
          <div class="sp-event-inner sp-event-inner-compact">
            <span class="sp-event-title">${title}</span>
            <span class="sp-event-time">${time}</span>
          </div>
        `,
      };
    }

    return {
      html: `
        <div class="sp-event-inner">
          <span class="sp-event-title">${title}</span>
          <span class="sp-event-time">${time}</span>
          ${status}
        </div>
      `,
    };
  }

  private toLocalDateTime(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, '0');

    return [
      date.getFullYear(),
      '-',
      pad(date.getMonth() + 1),
      '-',
      pad(date.getDate()),
      'T',
      pad(date.getHours()),
      ':',
      pad(date.getMinutes()),
      ':00',
    ].join('');
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('pt-BR');
  }

  private formatEventTime(date: Date): string {
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  emailInitials(email: string): string {
    const local = email.split('@')[0];
    const parts = local.split('.');
    return parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : local.slice(0, 2).toUpperCase();
  }

  calendarColor(calendarId: string): { bg: string; text: string; border: string } {
    return this.calendarColorMap().get(calendarId) ?? this.CALENDAR_COLORS[0];
  }

  private calendarColorClass(calendarId: string): string {
    const index = this.calendars().findIndex(calendar => calendar.id === calendarId);
    const colorIndex = index >= 0 ? index % this.CALENDAR_COLORS.length : 0;

    return `sp-calendar-${colorIndex}`;
  }

  eventTypeColor(type: EventType): string {
    const colors: Record<EventType, string> = {
      CLIENT: 'var(--sp-client)',
      PERSONAL: 'var(--sp-personal)',
      SHARED: 'var(--sp-shared)',
    };
    return colors[type];
  }

  eventAvatarInitials(event: EventResponse): string {
    const source = event.clientName || event.personName || event.title || event.createdByEmail;
    const initials = source
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase();

    return initials || 'EV';
  }

  eventAvatarColor(event: EventResponse): { bg: string; text: string } {
    return this.avatarColor(event.clientName || event.personName || event.createdByEmail);
  }

  avatarColor(email: string): { bg: string; text: string } {
    let hash = 0;
    for (let i = 0; i < email.length; i++) hash += email.charCodeAt(i);
    return this.AVATAR_COLORS[hash % this.AVATAR_COLORS.length];
  }

  private loadReadPendingIds(email: string): Set<string> {
    if (!this.canUseLocalStorage()) {
      return new Set();
    }

    try {
      const raw = localStorage.getItem(this.pendingReadStorageKey(email));
      const ids = raw ? JSON.parse(raw) : [];

      return Array.isArray(ids)
        ? new Set(ids.filter((id): id is string => typeof id === 'string'))
        : new Set();
    } catch {
      return new Set();
    }
  }

  private saveReadPendingIds(ids: Set<string>): void {
    const email = this.currentUser()?.email;

    if (!email || !this.canUseLocalStorage()) {
      return;
    }

    localStorage.setItem(this.pendingReadStorageKey(email), JSON.stringify([...ids]));
  }

  private pendingReadStorageKey(email: string): string {
    return `sharedPlanner.readPendingIds.${email.toLowerCase()}`;
  }

  private canUseLocalStorage(): boolean {
    return typeof localStorage !== 'undefined';
  }
}
