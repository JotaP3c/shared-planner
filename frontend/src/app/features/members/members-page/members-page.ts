import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Subscription, finalize } from 'rxjs';
import { CalendarService } from '../../../core/api/calendar.service';
import { AuthService } from '../../../core/auth/auth.service';
import { hasCalendarRole } from '../../../core/auth/calendar-permissions';
import { CalendarCreator } from '../../calendar/calendar-creator/calendar-creator';
import { CalendarMemberResponse, CalendarMemberRole, CalendarResponse } from '../../../core/models/shared-planner.models';

@Component({ selector: 'app-members-page', imports: [DatePipe, CalendarCreator], templateUrl: './members-page.html', styleUrl: './members-page.scss' })
export class MembersPage implements OnInit {
  private readonly calendarService = inject(CalendarService);
  private readonly authService = inject(AuthService);
  private membersSubscription: Subscription | null = null;
  private membersRequestId = 0;
  private static readonly EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  readonly additionalFinance = signal(false);
  readonly additionalEditor = signal(false);
  readonly selectedCalendar = computed(() => this.calendars().find(item => item.id === this.selectedCalendarId()) ?? null);
  readonly canManage = computed(() => this.authService.currentUser()?.role === 'ADMIN' || !!this.selectedCalendar() && hasCalendarRole(this.selectedCalendar()!, 'ADMIN'));

  onCalendarCreated(calendar: CalendarResponse): void {
    this.calendars.update(items => [...items, calendar]);
    this.selectCalendar(calendar.id);
    this.successMessage.set('Calendário compartilhado criado. Adicione os participantes e administradores.');
  }

  effectiveRoles(member: CalendarMemberResponse): CalendarMemberRole[] {
    return member.roles ?? [member.role];
  }

  rolesLabel(member: CalendarMemberResponse): string {
    return this.effectiveRoles(member).map(role => this.roleLabel(role)).join(' + ');
  }

  setAdditionalRole(member: CalendarMemberResponse, role: CalendarMemberRole, checked: boolean): void {
    if (!this.canManage() || this.isOwner(member) || this.isMemberBusy(member.id)) return;
    const roles = checked ? [...new Set([...this.effectiveRoles(member), role])]
      : this.effectiveRoles(member).filter(current => current !== role);
    if (!roles.length) return;
    this.setMemberBusy(member.id, true);
    this.calendarService.updateMember(member.calendarId, member.id, { role: roles[0], roles })
      .pipe(finalize(() => this.setMemberBusy(member.id, false)))
      .subscribe({
        next: updated => {
          if (member.calendarId === this.selectedCalendarId()) this.members.update(items => items.map(item => item.id === updated.id ? updated : item));
        },
        error: () => this.errorMessage.set('Não foi possível atualizar as permissões.'),
      });
  }

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

    if (!calendarId || !this.canManage()) {
      this.errorMessage.set('Selecione um calendário que você administra.');
      return;
    }

    if (!MembersPage.EMAIL_PATTERN.test(email)) {
      this.errorMessage.set('Informe um e-mail válido.');
      return;
    }

    this.clearMessages();
    this.isSaving.set(true);
    const roles = [...new Set([this.memberRole(), ...(this.additionalFinance() ? ['FINANCE' as const] : []), ...(this.additionalEditor() ? ['EDITOR' as const] : [])])];
    this.calendarService.addMember(calendarId, { email: email.toLowerCase(), role: this.memberRole(), ...(roles.length > 1 ? { roles } : {}) })
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: () => {
          if (calendarId !== this.selectedCalendarId()) {
            return;
          }

          this.memberEmail.set('');
          this.successMessage.set(`${email} agora tem acesso como ${this.roleLabel(this.memberRole())}.`);
          this.loadMembers(false);
        },
        error: error => this.errorMessage.set(this.addMemberErrorText(error)),
      });
  }

  /** Erros de domínio de POST /members (INC-03), traduzidos para orientar o próximo passo. */
  private addMemberErrorText(error: unknown): string {
    const status = (error as { status?: number })?.status;
    const detail = (error as { error?: { detail?: string } })?.error?.detail ?? '';

    if (status === 404 && detail.includes('User')) {
      return 'Não existe conta com este e-mail. Peça a um administrador para cadastrá-la em '
        + 'Administração › Usuários e depois adicione-a aqui.';
    }

    if (status === 404) {
      return 'Calendário não encontrado.';
    }

    if (status === 409 && detail.includes('inactive')) {
      return 'Esta conta está inativa. Reative-a em Administração › Usuários antes de adicioná-la.';
    }

    if (status === 409) {
      return 'Este usuário já é membro deste calendário. Para mudar o papel, use a lista abaixo.';
    }

    if (status === 403) {
      return 'Você não tem permissão para gerenciar os membros deste calendário.';
    }

    if (status === 400) {
      return 'Dados inválidos. Confira o e-mail e o papel.';
    }

    return 'Não foi possível adicionar o membro.';
  }

  updateRole(member: CalendarMemberResponse, role: CalendarMemberRole): void {
    if (!this.canManage() || this.isOwner(member) || member.role === role || this.isMemberBusy(member.id)) return;

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
    if (!this.canManage() || this.isOwner(member) || this.isMemberBusy(member.id)) return;
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
