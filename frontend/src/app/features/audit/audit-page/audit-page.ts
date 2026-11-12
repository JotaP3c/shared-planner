import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';

import { AuditService } from '../../../core/api/audit.service';
import { CalendarService } from '../../../core/api/calendar.service';
import { AuthService } from '../../../core/auth/auth.service';
import { hasCalendarRole } from '../../../core/auth/calendar-permissions';
import {
  AuditAction,
  AuditEntityType,
  AuditLogResponse,
  CalendarResponse,
} from '../../../core/models/shared-planner.models';

const ACTION_LABELS: Record<AuditAction, string> = {
  CREATED: 'Criação',
  UPDATED: 'Alteração',
  DELETED: 'Remoção',
  APPROVED: 'Aprovação',
  REJECTED: 'Reprovação',
  CANCELLED: 'Cancelamento',
  PAYMENT_UPDATED: 'Pagamento',
  MEMBER_ADDED: 'Membro adicionado',
  MEMBER_ROLE_UPDATED: 'Papel alterado',
  APPOINTMENT_CONFIRMED: 'Atendimento confirmado',
  APPOINTMENT_UNSCHEDULED: 'Atendimento desmarcado',
  APPOINTMENT_RESCHEDULED: 'Atendimento remarcado',
};

const ENTITY_LABELS: Record<AuditEntityType, string> = {
  USER: 'Usuário',
  CALENDAR: 'Calendário',
  CALENDAR_MEMBER: 'Membro',
  EVENT: 'Evento',
};

/**
 * Auditoria com os registros reais de GET /api/audit-logs. Por minimização (Q-006 ainda
 * aberta), os snapshots oldValue/newValue não são exibidos; só resumo, ação, autor e data.
 * O backend autoriza: ADMIN global vê tudo; ADMIN de calendário, só o próprio calendário.
 */
@Component({
  selector: 'app-audit-page',
  imports: [],
  templateUrl: './audit-page.html',
  styleUrl: './audit-page.scss',
})
export class AuditPage implements OnInit {
  private readonly auditService = inject(AuditService);
  private readonly calendarService = inject(CalendarService);
  private readonly authService = inject(AuthService);
  private requestId = 0;

  readonly limits = [25, 50, 100];
  readonly entityTypes = Object.keys(ENTITY_LABELS) as AuditEntityType[];
  readonly calendars = signal<CalendarResponse[]>([]);
  readonly logs = signal<AuditLogResponse[]>([]);
  readonly selectedCalendarId = signal('');
  readonly selectedEntityType = signal<AuditEntityType | ''>('');
  readonly selectedLimit = signal(50);
  readonly isLoading = signal(false);
  readonly hasLoaded = signal(false);
  readonly errorMessage = signal('');

  readonly isGlobalAdmin = computed(() => this.authService.currentUser()?.role === 'ADMIN');

  /** ADMIN global pode ver todos; ADMIN de calendário precisa escolher um calendário próprio. */
  readonly calendarOptions = computed(() =>
    this.isGlobalAdmin()
      ? this.calendars()
      : this.calendars().filter(calendar => hasCalendarRole(calendar, 'ADMIN')),
  );

  readonly showEmptyState = computed(() =>
    this.hasLoaded() && !this.isLoading() && !this.errorMessage() && this.logs().length === 0,
  );

  ngOnInit(): void {
    this.calendarService.list().subscribe({
      next: calendars => {
        this.calendars.set(calendars);

        if (!this.isGlobalAdmin()) {
          this.selectedCalendarId.set(this.calendarOptions()[0]?.id ?? '');
        }

        this.load();
      },
      error: () => this.errorMessage.set('Não foi possível carregar os calendários.'),
    });
  }

  selectCalendar(value: string): void {
    this.selectedCalendarId.set(value);
    this.load();
  }

  selectEntityType(value: string): void {
    this.selectedEntityType.set((value || '') as AuditEntityType | '');
    this.load();
  }

  selectLimit(value: string): void {
    this.selectedLimit.set(Number(value) || 50);
    this.load();
  }

  load(): void {
    if (!this.isGlobalAdmin() && !this.selectedCalendarId()) {
      this.logs.set([]);
      this.hasLoaded.set(true);
      return;
    }

    const requestId = ++this.requestId;
    this.errorMessage.set('');
    this.isLoading.set(true);

    this.auditService
      .search({
        calendarId: this.selectedCalendarId() || undefined,
        entityType: this.selectedEntityType() || undefined,
        limit: this.selectedLimit(),
      })
      .pipe(finalize(() => {
        if (requestId === this.requestId) {
          this.isLoading.set(false);
        }
      }))
      .subscribe({
        next: logs => {
          if (requestId === this.requestId) {
            this.logs.set(logs);
            this.hasLoaded.set(true);
          }
        },
        error: error => {
          if (requestId !== this.requestId) {
            return;
          }

          this.logs.set([]);
          this.errorMessage.set((error as { status?: number })?.status === 403
            ? 'Você não tem permissão para ver a auditoria deste escopo.'
            : 'Não foi possível carregar os registros de auditoria.');
        },
      });
  }

  actionLabel(action: AuditAction): string {
    return ACTION_LABELS[action] ?? action;
  }

  entityLabel(entityType: AuditEntityType): string {
    return ENTITY_LABELS[entityType] ?? entityType;
  }

  calendarName(calendarId: string | null): string {
    if (!calendarId) {
      return '—';
    }

    return this.calendars().find(calendar => calendar.id === calendarId)?.name ?? 'Calendário';
  }

  formatDateTime(value: string): string {
    return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }
}
