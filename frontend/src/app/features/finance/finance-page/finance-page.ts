import { Component, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { finalize } from 'rxjs';

import { CalendarService } from '../../../core/api/calendar.service';
import { FinanceService } from '../../../core/api/finance.service';
import { AuthService } from '../../../core/auth/auth.service';
import {
  CalendarResponse,
  FinanceSummaryResponse,
  RevenuePeriod,
} from '../../../core/models/shared-planner.models';

type FinancePeriod = RevenuePeriod | 'CUSTOM';

interface DateRange {
  startDate: string;
  endDate: string;
}

@Component({
  selector: 'app-finance-page',
  imports: [],
  templateUrl: './finance-page.html',
  styleUrl: './finance-page.scss',
})
export class FinancePage implements OnInit {
  private readonly calendarService = inject(CalendarService);
  private readonly financeService = inject(FinanceService);
  private readonly authService = inject(AuthService);
  private calendarRequestId = 0;
  private summaryRequestId = 0;

  readonly currentUser = this.authService.currentUser;
  readonly periodOptions: ReadonlyArray<{ value: FinancePeriod; label: string }> = [
    { value: 'DAILY', label: 'Diário' },
    { value: 'WEEKLY', label: 'Semanal' },
    { value: 'BIWEEKLY', label: 'Quinzenal' },
    { value: 'MONTHLY', label: 'Mensal' },
    { value: 'CUSTOM', label: 'Personalizado' },
  ];

  readonly calendars = signal<CalendarResponse[]>([]);
  readonly calendarsLoaded = signal(false);
  readonly selectedCalendarId = signal('');
  readonly selectedPeriod = signal<FinancePeriod>('MONTHLY');
  readonly referenceDate = signal(this.localToday());
  readonly customStartDate = signal(this.localToday());
  readonly customEndDate = signal(this.localToday());
  readonly summary = signal<FinanceSummaryResponse | null>(null);
  readonly isLoadingCalendars = signal(false);
  readonly isLoadingSummary = signal(false);
  readonly calendarErrorMessage = signal('');
  readonly errorMessage = signal('');

  readonly authorizedCalendars = computed(() => {
    const user = this.currentUser();
    const calendars = this.calendars();

    if (!user) {
      return [];
    }

    if (user.role === 'ADMIN') {
      return calendars;
    }

    if (user.role === 'FINANCE') {
      return calendars.filter(calendar => calendar.memberRole !== null);
    }

    return calendars.filter(calendar =>
      calendar.memberRole === 'ADMIN' || calendar.memberRole === 'FINANCE',
    );
  });

  readonly selectedCalendar = computed(() =>
    this.authorizedCalendars().find(calendar => calendar.id === this.selectedCalendarId()) ?? null,
  );

  readonly selectedDateRange = computed<DateRange | null>(() =>
    this.resolveDateRange(
      this.selectedPeriod(),
      this.referenceDate(),
      this.customStartDate(),
      this.customEndDate(),
    ),
  );

  readonly noAccess = computed(() =>
    this.calendarsLoaded()
      && !this.isLoadingCalendars()
      && !this.calendarErrorMessage()
      && this.authorizedCalendars().length === 0,
  );

  readonly isEmpty = computed(() => this.summary()?.appointmentCount === 0);

  readonly periodLabel = computed(() => {
    const range = this.selectedDateRange();

    if (!range) {
      return 'Período inválido';
    }

    if (range.startDate === range.endDate) {
      return this.formatDate(range.startDate);
    }

    return `${this.formatDate(range.startDate)} a ${this.formatDate(range.endDate)}`;
  });

  constructor() {
    effect(() => {
      if (!this.calendarsLoaded()) {
        return;
      }

      const calendars = this.authorizedCalendars();
      const selectedId = this.selectedCalendarId();

      untracked(() => {
        if (!calendars.length) {
          this.selectedCalendarId.set('');
          this.invalidateSummary();
          return;
        }

        if (!calendars.some(calendar => calendar.id === selectedId)) {
          this.selectedCalendarId.set(calendars[0].id);
          this.loadSummary();
        }
      });
    });
  }

  ngOnInit(): void {
    this.loadCalendars();
  }

  loadCalendars(): void {
    const requestId = ++this.calendarRequestId;
    this.calendarErrorMessage.set('');
    this.errorMessage.set('');
    this.calendarsLoaded.set(false);
    this.isLoadingCalendars.set(true);

    this.calendarService
      .list()
      .pipe(finalize(() => {
        if (requestId === this.calendarRequestId) {
          this.isLoadingCalendars.set(false);
          this.calendarsLoaded.set(true);
        }
      }))
      .subscribe({
        next: calendars => {
          if (requestId === this.calendarRequestId) {
            this.calendars.set(calendars);
          }
        },
        error: error => {
          if (requestId !== this.calendarRequestId) {
            return;
          }

          this.calendars.set([]);
          this.invalidateSummary();
          this.calendarErrorMessage.set(
            this.errorText(error, 'Não foi possível carregar os calendários.'),
          );
        },
      });
  }

  selectCalendar(calendarId: string): void {
    if (!this.authorizedCalendars().some(calendar => calendar.id === calendarId)) {
      return;
    }

    this.selectedCalendarId.set(calendarId);
    this.loadSummary();
  }

  selectPeriod(period: string): void {
    if (!this.isFinancePeriod(period)) {
      return;
    }

    this.selectedPeriod.set(period);
    this.invalidateSummary();
    this.errorMessage.set('');
  }

  setReferenceDate(value: string): void {
    this.referenceDate.set(value);
    this.invalidateSummary();
    this.errorMessage.set('');
  }

  setCustomStartDate(value: string): void {
    this.customStartDate.set(value);
    this.invalidateSummary();
    this.errorMessage.set('');
  }

  setCustomEndDate(value: string): void {
    this.customEndDate.set(value);
    this.invalidateSummary();
    this.errorMessage.set('');
  }

  applyFilters(): void {
    if (!this.selectedDateRange()) {
      this.invalidateSummary();
      this.errorMessage.set('Informe um período válido, com a data final igual ou posterior à inicial.');
      return;
    }

    this.loadSummary();
  }

  refresh(): void {
    this.loadSummary();
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value ?? 0);
  }

  private loadSummary(): void {
    const calendarId = this.selectedCalendarId();
    const range = this.selectedDateRange();

    if (!calendarId || !range) {
      this.invalidateSummary();
      return;
    }

    const requestId = ++this.summaryRequestId;
    this.errorMessage.set('');
    this.summary.set(null);
    this.isLoadingSummary.set(true);

    this.financeService
      .summarize(calendarId, range.startDate, range.endDate)
      .pipe(finalize(() => {
        if (requestId === this.summaryRequestId) {
          this.isLoadingSummary.set(false);
        }
      }))
      .subscribe({
        next: summary => {
          if (requestId === this.summaryRequestId) {
            this.summary.set(summary);
          }
        },
        error: error => {
          if (requestId === this.summaryRequestId) {
            this.errorMessage.set(
              this.errorText(error, 'Não foi possível carregar o resumo financeiro.'),
            );
          }
        },
      });
  }

  private invalidateSummary(): void {
    this.summaryRequestId++;
    this.summary.set(null);
    this.isLoadingSummary.set(false);
  }

  private resolveDateRange(
    period: FinancePeriod,
    referenceDate: string,
    customStartDate: string,
    customEndDate: string,
  ): DateRange | null {
    if (period === 'CUSTOM') {
      const start = this.parseDate(customStartDate);
      const end = this.parseDate(customEndDate);

      if (!start || !end || end.getTime() < start.getTime()) {
        return null;
      }

      return {
        startDate: this.formatIsoDate(start),
        endDate: this.formatIsoDate(end),
      };
    }

    const reference = this.parseDate(referenceDate);

    if (!reference) {
      return null;
    }

    if (period === 'DAILY') {
      const date = this.formatIsoDate(reference);
      return { startDate: date, endDate: date };
    }

    if (period === 'WEEKLY') {
      const daysSinceMonday = (reference.getDay() + 6) % 7;
      const start = this.addDays(reference, -daysSinceMonday);
      return {
        startDate: this.formatIsoDate(start),
        endDate: this.formatIsoDate(this.addDays(start, 6)),
      };
    }

    if (period === 'BIWEEKLY') {
      const year = reference.getFullYear();
      const month = reference.getMonth();
      const firstHalf = reference.getDate() <= 15;
      const start = new Date(year, month, firstHalf ? 1 : 16);
      const end = firstHalf ? new Date(year, month, 15) : new Date(year, month + 1, 0);
      return {
        startDate: this.formatIsoDate(start),
        endDate: this.formatIsoDate(end),
      };
    }

    const start = new Date(reference.getFullYear(), reference.getMonth(), 1);
    const end = new Date(reference.getFullYear(), reference.getMonth() + 1, 0);
    return {
      startDate: this.formatIsoDate(start),
      endDate: this.formatIsoDate(end),
    };
  }

  private parseDate(value: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

    if (!match) {
      return null;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day);

    if (
      date.getFullYear() !== year
      || date.getMonth() !== month - 1
      || date.getDate() !== day
    ) {
      return null;
    }

    return date;
  }

  private addDays(date: Date, days: number): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
  }

  private formatIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatDate(value: string): string {
    const date = this.parseDate(value);
    return date
      ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(date)
      : value;
  }

  private localToday(): string {
    return this.formatIsoDate(new Date());
  }

  private isFinancePeriod(value: string): value is FinancePeriod {
    return this.periodOptions.some(period => period.value === value);
  }

  private errorText(error: unknown, fallback: string): string {
    const body = (error as { error?: { detail?: string; message?: string } })?.error;
    return body?.detail || body?.message || fallback;
  }
}
