import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';

import { EventService } from '../../../core/api/event.service';
import { AuthService } from '../../../core/auth/auth.service';
import { EventResponse } from '../../../core/models/shared-planner.models';

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

  readonly currentUser = this.authService.currentUser;
  readonly pendingEvents = signal<EventResponse[]>([]);
  readonly isLoading = signal(false);
  readonly errorMessage = signal('');
  readonly actionEventId = signal<string | null>(null);
  readonly pendingCount = computed(() => this.pendingEvents().length);

  ngOnInit(): void {
    this.loadPendingEvents();
  }

  loadPendingEvents(): void {
    this.errorMessage.set('');
    this.isLoading.set(true);

    this.eventService
      .listPendingApprovals()
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: events => this.pendingEvents.set(events),
        error: () => this.errorMessage.set('Nao foi possivel carregar as pendencias.'),
      });
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
    const confirmed = window.confirm(`Deseja reprovar o evento "${event.title}"?`);

    if (!confirmed) {
      return;
    }

    this.respond(event, 'reject');
  }

  canRespond(event: EventResponse): boolean {
    const currentUser = this.currentUser();

    return !!currentUser
      && event.status === 'PENDING_APPROVAL'
      && !!event.approvalRequestedFromEmail
      && event.approvalRequestedFromEmail.toLowerCase() === currentUser.email.toLowerCase();
  }

  formatDateTime(value: string): string {
    return new Date(value).toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  }

  eventTitle(event: EventResponse): string {
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
    if (!this.canRespond(event)) {
      this.errorMessage.set('Esta pendencia nao esta aguardando a sua aprovacao.');
      return;
    }

    this.errorMessage.set('');
    this.actionEventId.set(event.id);

    const request = action === 'approve'
      ? this.eventService.approve(event.id)
      : this.eventService.reject(event.id);

    request
      .pipe(finalize(() => this.actionEventId.set(null)))
      .subscribe({
        next: () => {
          this.pendingEvents.update(events =>
            events.filter(currentEvent => currentEvent.id !== event.id),
          );
        },
        error: () => {
          const message = action === 'approve'
            ? 'Nao foi possivel aprovar este evento.'
            : 'Nao foi possivel reprovar este evento.';

          this.errorMessage.set(message);
        },
      });
  }
}
