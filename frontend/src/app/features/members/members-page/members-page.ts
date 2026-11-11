import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Subscription, finalize } from 'rxjs';
import { CalendarService } from '../../../core/api/calendar.service';
import { AuthService } from '../../../core/auth/auth.service';
import { CalendarMemberResponse, CalendarMemberRole, CalendarResponse } from '../../../core/models/shared-planner.models';

@Component({ selector: 'app-members-page', imports: [DatePipe], templateUrl: './members-page.html', styleUrl: './members-page.scss' })
export class MembersPage implements OnInit {
  private readonly calendarService = inject(CalendarService);
  private readonly authService = inject(AuthService);
  private membersSubscription: Subscription | null = null;
  private membersRequestId = 0;

  readonly roles: CalendarMemberRole[] = ['ADMIN', 'EDITOR', 'FINANCE', 'VIEWER'];
  readonly calendars = signal<CalendarResponse[]>([]);
  readonly selectedCalendarId = signal('');
  readonly members = signal<CalendarMemberResponse[]>([]);
  // BLG-BUG-006: loading de calendários e de membros são independentes,
  // para que o término de um não esconda o carregamento do outro.
  readonly isLoadingCalendars = signal(false);
  readonly isLoadingMembers = signal(false);
  readonly isLoading = computed(() => this.isLoadingCalendars() || this.isLoadingMembers());
  readonly isSaving = signal(false);
  readonly actionMemberIds = signal<ReadonlySet<string>>(new Set());
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly memberEmail = signal('');
  readonly memberRole = signal<CalendarMemberRole>('VIEWER');
  readonly selectedCalendar = computed(() => this.calendars().find(item => item.id === this.selectedCalendarId()) ?? null);
  readonly canManage = computed(() => this.authService.currentUser()?.role === 'ADMIN' || this.selectedCalendar()?.memberRole === 'ADMIN');

  ngOnInit(): void {
    this.loadCalendars();
  }

  selectCalendar(id: string): void {
    if (id === this.selectedCalendarId()) {
      return;
    }

    this.selectedCalendarId.set(id);
    // A lista do calendário anterior não pode continuar visível sob o novo calendário.
    this.members.set([]);
    this.loadMembers();
  }

  addMember(): void {
    const calendarId = this.selectedCalendarId();
    const email = this.memberEmail().trim();

    if (!calendarId || !email || !this.canManage()) {
      this.errorMessage.set('Informe um e-mail válido e selecione um calendário administrável.');
      return;
    }

    this.clearMessages();
    this.isSaving.set(true);
    this.calendarService.addMember(calendarId, { email, role: this.memberRole() })
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: () => {
          if (calendarId !== this.selectedCalendarId()) {
            return;
          }

          this.memberEmail.set('');
          this.successMessage.set('Membro adicionado ou atualizado.');
          this.loadMembers(false);
        },
        error: error => this.errorMessage.set(this.errorText(error, 'Não foi possível adicionar o membro.')),
      });
  }

  updateRole(member: CalendarMemberResponse, role: CalendarMemberRole): void {
    if (!this.canManage() || member.role === role || this.isMemberBusy(member.id)) return;

    this.clearMessages();
    this.setMemberBusy(member.id, true);
    this.calendarService.updateMember(member.calendarId, member.id, { role })
      .pipe(finalize(() => this.setMemberBusy(member.id, false)))
      .subscribe({
        next: updated => {
          if (member.calendarId !== this.selectedCalendarId()) return;
          this.members.update(items => items.map(item => item.id === updated.id ? updated : item));
          this.successMessage.set('Papel atualizado.');
        },
        error: error => this.errorMessage.set(this.errorText(error, 'Não foi possível atualizar o papel.')),
      });
  }

  removeMember(member: CalendarMemberResponse): void {
    if (!this.canManage() || this.isMemberBusy(member.id)) return;
    if (!window.confirm(`Remover ${member.userFullName} deste calendário?`)) return;

    this.clearMessages();
    this.setMemberBusy(member.id, true);
    this.calendarService.removeMember(member.calendarId, member.id)
      .pipe(finalize(() => this.setMemberBusy(member.id, false)))
      .subscribe({
        next: () => {
          if (member.calendarId !== this.selectedCalendarId()) return;
          this.members.update(items => items.filter(item => item.id !== member.id));
          this.successMessage.set('Membro removido.');
        },
        error: error => this.errorMessage.set(this.errorText(error, 'Não foi possível remover o membro.')),
      });
  }

  roleLabel(role: CalendarMemberRole): string {
    const labels: Record<CalendarMemberRole, string> = {
      ADMIN: 'Administrador',
      EDITOR: 'Editor',
      FINANCE: 'Financeiro',
      VIEWER: 'Leitor',
    };

    return labels[role] ?? role;
  }

  isMemberBusy(memberId: string): boolean {
    return this.actionMemberIds().has(memberId);
  }

  isOwner(member: CalendarMemberResponse): boolean {
    return this.selectedCalendar()?.ownerEmail.toLowerCase() === member.userEmail.toLowerCase();
  }

  private loadCalendars(): void {
    this.isLoadingCalendars.set(true);
    this.calendarService.list()
      .pipe(finalize(() => this.isLoadingCalendars.set(false)))
      .subscribe({
        next: calendars => {
          this.calendars.set(calendars);
          const id = calendars[0]?.id ?? '';
          this.selectedCalendarId.set(id);
          if (id) this.loadMembers();
        },
        error: error => this.errorMessage.set(this.errorText(error, 'Não foi possível carregar os calendários.')),
      });
  }

  private loadMembers(clear = true): void {
    const id = this.selectedCalendarId();
    const requestId = ++this.membersRequestId;

    // Latest-wins: cancela a carga anterior (de outro calendário ou recarga).
    this.membersSubscription?.unsubscribe();
    this.membersSubscription = null;

    if (!id) {
      this.members.set([]);
      this.isLoadingMembers.set(false);
      return;
    }

    if (clear) this.clearMessages();
    this.isLoadingMembers.set(true);

    this.membersSubscription = this.calendarService.listMembers(id).subscribe({
      next: members => {
        if (requestId !== this.membersRequestId) return;
        this.members.set(members);
        this.isLoadingMembers.set(false);
      },
      error: error => {
        if (requestId !== this.membersRequestId) return;
        this.members.set([]);
        this.errorMessage.set(this.errorText(error, 'Não foi possível carregar os membros.'));
        this.isLoadingMembers.set(false);
      },
    });
  }

  private setMemberBusy(memberId: string, busy: boolean): void {
    this.actionMemberIds.update(current => {
      const next = new Set(current);
      if (busy) next.add(memberId); else next.delete(memberId);
      return next;
    });
  }

  private clearMessages(): void {
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  private errorText(error: unknown, fallback: string): string {
    const body = (error as { error?: { detail?: string; message?: string } })?.error;
    return body?.detail || body?.message || fallback;
  }
}
