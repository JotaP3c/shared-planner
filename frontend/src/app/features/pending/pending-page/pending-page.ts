import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';

import { EventService } from '../../../core/api/event.service';
import { AuthService } from '../../../core/auth/auth.service';
import { canRespondToApproval } from '../../../core/auth/calendar-permissions';
import { EventResponse } from '../../../core/models/shared-planner.models';
import { DataChangeService } from '../../../core/state/data-change.service';

@Component({
  selector: 'app-pending-page',
  imports: [],
  templateUrl: './pending-page.html',
  styleUrl: './pending-page.scss',
})
export class PendingPage implements OnInit {
  private readonly eventService = inject(EventService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly mutations = inject(DataChangeService);
  private loadRequestId = 0;
  // Decisões recentes: evento -> última consulta iniciada ANTES da decisão. Uma resposta de
  // consulta anterior à decisão não ressuscita o item; uma consulta iniciada depois é
  // autoritativa (inclusive para pendência reaberta) e descarta a marca.
  private readonly resolvedAtRequest = new Map<string, number>();

  readonly currentUser = this.authService.currentUser;
  readonly pendingEvents = signal<EventResponse[]>([]);
  readonly isLoading = signal(false);
  readonly hasLoaded = signal(false);
  /** Falha ao carregar a fila: não deve ser confundida com fila vazia. */
  readonly loadError = signal('');
  /** Falha de uma ação (aprovar/reprovar). */
  readonly errorMessage = signal('');
  /** BLG-BUG-008: ações concorrentes são rastreadas por item. */
  readonly actionEventIds = signal<ReadonlySet<string>>(new Set());
  readonly pendingCount = computed(() => this.pendingEvents().length);
  readonly showEmptyState = computed(() =>
    this.hasLoaded() && !this.isLoading() && !this.loadError() && this.pendingEvents().length === 0,
  );

  ngOnInit(): void {
    this.loadPendingEvents();
  }

  loadPendingEvents(): void {
    const requestId = ++this.loadRequestId;

    this.loadError.set('');
    this.isLoading.set(true);

    this.eventService
      .listPendingApprovals()
      .pipe(finalize(() => {
        if (requestId === this.loadRequestId) {
          this.isLoading.set(false);
        }
      }))
      .subscribe({
        next: events => {
          if (requestId !== this.loadRequestId) {
            return;
          }

          this.pendingEvents.set(events.filter(event => {
            const decidedAfterRequest = this.resolvedAtRequest.get(event.id);
            return decidedAfterRequest === undefined || requestId > decidedAfterRequest;
          }));
          for (const [eventId, marker] of this.resolvedAtRequest) {
            if (requestId > marker) {
              this.resolvedAtRequest.delete(eventId);
            }
          }
          this.hasLoaded.set(true);
        },
        error: () => {
          if (requestId !== this.loadRequestId) {
            return;
          }

          this.loadError.set('Não foi possível carregar as pendências.');
        },
      });
  }

  isActionInProgress(eventId: string): boolean {
    return this.actionEventIds().has(eventId);
  }

  openInCalendar(event: EventResponse): void {
    this.router.navigate(['/calendar'], {
      queryParams: {
        eventId: event.id,
        calendarId: event.calendarId,
        date: event.startsAt.slice(0, 10),
      },
    });
  }

  approve(event: EventResponse): void {
    this.respond(event, 'approve');
  }

  reject(event: EventResponse): void {
    if (this.isActionInProgress(event.id)) {
      return;
    }

    const confirmed = window.confirm(`Deseja reprovar o evento "${event.title}"?`);

    if (!confirmed) {
      return;
    }

    this.respond(event, 'reject');
  }

  canRespond(event: EventResponse): boolean {
    const currentUser = this.currentUser();

    return canRespondToApproval(event, currentUser?.email);
  }

  formatDateTime(value: string): string {
    return new Date(value).toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  }

  eventTitle(event: EventResponse): string {
    if (event.externalSource === 'GOOGLE_ICS') return event.title;
    if (event.eventType === 'CLIENT') {
      return event.clientName || event.title || 'Cliente';
    }

    if (event.eventType === 'PERSONAL') {
      return event.personName || event.title || 'Pessoal';
    }

    return event.title || 'Compartilhado';
  }

  eventTypeLabel(event: EventResponse): string {
    const labels: Record<string, string> = {
      CLIENT: 'Cliente',
      PERSONAL: 'Pessoal',
      SHARED: 'Compartilhado',
    };

    return labels[event.eventType] ?? event.eventType;
  }

  emailInitials(email: string): string {
    const local = email.split('@')[0];
    const parts = local.split('.');
    return parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : local.slice(0, 2).toUpperCase();
  }

  private respond(event: EventResponse, action: 'approve' | 'reject'): void {
    if (this.isActionInProgress(event.id)) {
      return;
    }

    if (!this.canRespond(event)) {
      this.errorMessage.set('Esta pendência não está aguardando a sua aprovação.');
      return;
    }

    this.errorMessage.set('');
    this.setActionInProgress(event.id, true);

    const request = action === 'approve'
      ? this.eventService.approve(event.id)
      : this.eventService.reject(event.id);

    request
      .pipe(finalize(() => this.setActionInProgress(event.id, false)))
      .subscribe({
        next: () => {
          this.resolvedAtRequest.set(event.id, this.loadRequestId);
          this.mutations.notify();
          this.pendingEvents.update(events =>
            events.filter(currentEvent => currentEvent.id !== event.id),
          );
        },
        error: () => {
          const message = action === 'approve'
            ? 'Não foi possível aprovar este evento.'
            : 'Não foi possível reprovar este evento.';

          this.errorMessage.set(message);
        },
      });
  }

  private setActionInProgress(eventId: string, inProgress: boolean): void {
    this.actionEventIds.update(current => {
      const next = new Set(current);

      if (inProgress) {
        next.add(eventId);
      } else {
        next.delete(eventId);
      }

      return next;
    });
  }
}
