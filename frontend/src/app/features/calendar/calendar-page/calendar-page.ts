import { Component, OnInit, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FullCalendarComponent, FullCalendarModule } from '@fullcalendar/angular';
import { CalendarOptions, DatesSetArg, EventInput } from '@fullcalendar/core';
import ptBrLocale from '@fullcalendar/core/locales/pt-br';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import timeGridPlugin from '@fullcalendar/timegrid';
import { catchError, finalize, forkJoin, map, of } from 'rxjs';

import { CalendarService } from '../../../core/api/calendar.service';
import { EventService } from '../../../core/api/event.service';
import { SearchService } from '../../../core/api/search.service';
import { AuthService } from '../../../core/auth/auth.service';
import {
  CalendarResponse,
  CreateEventRequest,
  EventResponse,
  EventType,
  UpdateEventRequest,
} from '../../../core/models/shared-planner.models';


@Component({
  selector: 'app-calendar-page',
  imports: [FullCalendarModule, ReactiveFormsModule],
  templateUrl: './calendar-page.html',
  styleUrl: './calendar-page.scss',
})
export class CalendarPage implements OnInit {
  @ViewChild('calendar') calendarComponent?: FullCalendarComponent;

  private readonly calendarService = inject(CalendarService);
  private readonly eventService = inject(EventService);
  private readonly searchService = inject(SearchService);
  private readonly authService = inject(AuthService);
  private readonly formBuilder = inject(NonNullableFormBuilder);

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

  readonly eventForm = this.formBuilder.group({
    calendarId: ['', Validators.required],
    eventType: ['CLIENT' as EventType, Validators.required],
    title: ['', [Validators.required, Validators.maxLength(180)]],
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

  readonly calendars = signal<CalendarResponse[]>([]);
  readonly selectedCalendarIds = signal<string[]>([]);
  readonly events = signal<EventResponse[]>([]);
  readonly currentUser = this.authService.currentUser;

  readonly selectedEventTypes = signal<EventType[]>(['CLIENT', 'PERSONAL', 'SHARED']);
  readonly visibleStart = signal<Date | null>(null);
  readonly visibleEnd = signal<Date | null>(null);
  readonly isLoading = signal(false);
  readonly errorMessage = signal('');
  readonly notificationsRead = signal(false);
  readonly openFilterMenu = signal<'calendars' | 'events' | null>(null);

  readonly eventTypeOptions: Array<{ value: EventType; label: string }> = [
    { value: 'CLIENT', label: 'Cliente' },
    { value: 'PERSONAL', label: 'Pessoal' },
    { value: 'SHARED', label: 'Compartilhado' },
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

  readonly filteredEvents = computed(() => {
    const term = this.searchService.term().trim().toLowerCase();
    const selectedTypes = this.selectedEventTypes();

    return this.events().filter(event => {
      const matchesType = selectedTypes.includes(event.eventType);

      const searchable = [
        event.title,
        event.clientName,
        event.personName,
        event.description,
        event.workDescription,
        event.createdByEmail,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return matchesType && (!term || searchable.includes(term));
    });
  });

  readonly pendingEvents = computed(() =>
    this.filteredEvents().filter(event => event.status === 'PENDING_APPROVAL'),
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
      return 'Periodo carregando';
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
    locale: ptBrLocale,
    headerToolbar: false,
    allDaySlot: false,
    height: 'auto',
    slotMinTime: '08:00:00',
    slotMaxTime: '24:00:00',
    slotDuration: '01:00:00',
    eventDisplay: 'block',
    nowIndicator: true,
    editable: false,
    selectable: true,
    selectMirror: true,
    expandRows: true,
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
    events: [],
  };


  constructor() {
    effect(() => {
      this.calendarOptions = {
        ...this.calendarOptions,
        events: this.toCalendarEvents(this.filteredEvents()),
      };
    });
  }

  ngOnInit(): void {
    this.loadCalendars();
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
    this.calendarComponent?.getApi().changeView(viewName);
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
    this.notificationsRead.set(true);
  }

  openEventDetails(event: EventResponse): void {
    this.eventDetailError.set('');
    this.selectedEvent.set(event);
  }

  closeEventDetails(): void {
    if (this.isDeletingEvent() || this.isUpdatingApproval()) {
      return;
    }

    this.eventDetailError.set('');
    this.selectedEvent.set(null);
  }

  openNewEventModal(start?: Date, end?: Date): void {
    const startsAt = start ?? new Date();
    const endsAt = end ?? this.addMinutes(startsAt, 60);
    const calendarId = this.selectedCalendarIds()[0] ?? this.calendars()[0]?.id ?? '';

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
      amount: event.amount === null ? '' : String(event.amount),
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
      this.eventFormError.set('Preencha os campos obrigatórios para criar o evento.');
      return;
    }

    const raw = this.eventForm.getRawValue();
    const calendarId = this.cleanText(raw.calendarId);
    const eventType = raw.eventType;
    const title = this.cleanText(raw.title);
    const clientName = this.cleanText(raw.clientName);
    const personName = this.cleanText(raw.personName);
    const description = this.cleanText(raw.description);
    const workDescription = this.cleanText(raw.workDescription);
    const approvalRequestedFromEmail = this.cleanText(raw.approvalRequestedFromEmail);

    if (!calendarId) {
      this.eventFormError.set('Selecione o calendário do evento.');
      return;
    }

    if (eventType === 'CLIENT' && !clientName) {
      this.eventFormError.set('Informe o nome do cliente.');
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
        },
        error: (error) => {
          this.eventFormError.set(
            this.extractErrorMessage(error, 'Nao foi possivel salvar o evento. Verifique os dados e tente novamente.'),
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
        },
        error: (error) => {
          this.eventDetailError.set(
            this.extractErrorMessage(error, 'Nao foi possivel cancelar/desmarcar este evento.'),
          );
        },
      });
  }

  approveSelectedEvent(): void {
    this.respondToSelectedEvent('approve');
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

  calendarName(calendarId: string): string {
    return this.calendars().find(calendar => calendar.id === calendarId)?.name ?? 'Calendario';
  }

  eventTypeLabel(eventType: EventType): string {
    return this.eventTypeOptions.find(option => option.value === eventType)?.label ?? eventType;
  }

  eventStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      SCHEDULED: 'Agendado',
      PENDING_APPROVAL: 'Pendente de aprovacao',
      APPROVED: 'Aprovado',
      REJECTED: 'Reprovado',
      CANCELLED: 'Cancelado',
    };

    return labels[status] ?? status;
  }

  formatDateTime(value: string): string {
    return new Date(value).toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  }

  formatMoney(value: number | null): string {
    if (value === null) {
      return '-';
    }

    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
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
      return 'Voce nao tem permissao para executar esta acao neste calendario.';
    }

    if (httpError.status === 400) {
      return 'Dados invalidos. Revise os campos obrigatorios do evento.';
    }

    if (httpError.status === 404) {
      return 'Calendario ou usuario informado nao foi encontrado.';
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
      },
      error: () => {
        this.errorMessage.set('Nao foi possivel carregar os calendarios.');
      },
    });
  }

  private loadEvents(): void {
    const start = this.visibleStart();
    const end = this.visibleEnd();
    const calendarIds = this.selectedCalendarIds();

    if (!start || !end || !calendarIds.length) {
      this.events.set([]);
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    const requests = calendarIds.map(calendarId =>
      this.eventService
        .list(calendarId, this.toLocalDateTime(start), this.toLocalDateTime(end))
        .pipe(catchError(() => of([] as EventResponse[]))),
    );

    forkJoin(requests)
      .pipe(
        map(groups => groups.flat()),
        finalize(() => this.isLoading.set(false)),
      )
      .subscribe({
        next: events => this.events.set(events),
        error: () => this.errorMessage.set('Nao foi possivel carregar os eventos.'),
      });
  }

  private respondToSelectedEvent(action: 'approve' | 'reject'): void {
    const event = this.selectedEvent();

    if (!event || !this.canRespondToSelectedEvent()) {
      return;
    }

    this.eventDetailError.set('');
    this.isUpdatingApproval.set(true);

    const request = action === 'approve'
      ? this.eventService.approve(event.id)
      : this.eventService.reject(event.id);

    request
      .pipe(finalize(() => this.isUpdatingApproval.set(false)))
      .subscribe({
        next: updatedEvent => {
          this.events.update(events =>
            events.map(currentEvent =>
              currentEvent.id === updatedEvent.id ? updatedEvent : currentEvent,
            ),
          );
          this.selectedEvent.set(updatedEvent);
        },
        error: error => {
          const fallback = action === 'approve'
            ? 'Nao foi possivel aprovar este evento.'
            : 'Nao foi possivel reprovar este evento.';

          this.eventDetailError.set(this.extractErrorMessage(error, fallback));
        },
      });
  }

  private onDatesSet(arg: DatesSetArg): void {
    this.visibleStart.set(arg.start);
    this.visibleEnd.set(arg.end);
    this.loadEvents();
  }

  private toCalendarEvents(events: EventResponse[]): EventInput[] {
    return events.map(event => {
      const colors = this.calendarColor(event.calendarId);
      return {
        id: event.id,
        title: this.eventTitle(event),
        start: event.startsAt,
        end: event.endsAt,
        backgroundColor: colors.bg,
        textColor: colors.text,
        borderColor: colors.border,
        display: 'block',
        classNames: [
          'sp-event-block',
          this.calendarColorClass(event.calendarId),
          event.status === 'PENDING_APPROVAL' ? 'sp-event-pending' : '',
        ],
        extendedProps: event,
      };
    });
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
      CLIENT: '#3b82f6',
      PERSONAL: '#22c55e',
      SHARED: '#8b5cf6',
    };
    return colors[type];
  }

  avatarColor(email: string): { bg: string; text: string } {
    let hash = 0;
    for (let i = 0; i < email.length; i++) hash += email.charCodeAt(i);
    return this.AVATAR_COLORS[hash % this.AVATAR_COLORS.length];
  }
}
