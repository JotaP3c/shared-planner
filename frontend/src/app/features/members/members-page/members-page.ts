import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { CalendarService } from '../../../core/api/calendar.service';
import { AuthService } from '../../../core/auth/auth.service';
import { CalendarMemberResponse, CalendarMemberRole, CalendarResponse } from '../../../core/models/shared-planner.models';

@Component({ selector: 'app-members-page', imports: [DatePipe], templateUrl: './members-page.html', styleUrl: './members-page.scss' })
export class MembersPage implements OnInit {
  private readonly calendarService = inject(CalendarService);
  private readonly authService = inject(AuthService);
  readonly roles: CalendarMemberRole[] = ['ADMIN', 'EDITOR', 'FINANCE', 'VIEWER'];
  readonly calendars = signal<CalendarResponse[]>([]); readonly selectedCalendarId = signal('');
  readonly members = signal<CalendarMemberResponse[]>([]); readonly isLoading = signal(false);
  readonly isSaving = signal(false); readonly actionMemberId = signal<string | null>(null);
  readonly errorMessage = signal(''); readonly successMessage = signal('');
  readonly memberEmail = signal(''); readonly memberRole = signal<CalendarMemberRole>('VIEWER');
  readonly selectedCalendar = computed(() => this.calendars().find(item => item.id === this.selectedCalendarId()) ?? null);
  readonly canManage = computed(() => this.authService.currentUser()?.role === 'ADMIN' || this.selectedCalendar()?.memberRole === 'ADMIN');

  ngOnInit(): void { this.loadCalendars(); }
  selectCalendar(id: string): void { this.selectedCalendarId.set(id); this.loadMembers(); }
  addMember(): void {
    const calendarId = this.selectedCalendarId(); const email = this.memberEmail().trim();
    if (!calendarId || !email || !this.canManage()) { this.errorMessage.set('Informe um e-mail válido e selecione um calendário administrável.'); return; }
    this.clearMessages(); this.isSaving.set(true);
    this.calendarService.addMember(calendarId, { email, role: this.memberRole() }).pipe(finalize(() => this.isSaving.set(false))).subscribe({
      next: () => { this.memberEmail.set(''); this.successMessage.set('Membro adicionado ou atualizado.'); this.loadMembers(false); },
      error: error => this.errorMessage.set(this.errorText(error, 'Não foi possível adicionar o membro.')),
    });
  }
  updateRole(member: CalendarMemberResponse, role: CalendarMemberRole): void {
    if (!this.canManage() || member.role === role) return;
    this.clearMessages(); this.actionMemberId.set(member.id);
    this.calendarService.updateMember(member.calendarId, member.id, { role }).pipe(finalize(() => this.actionMemberId.set(null))).subscribe({
      next: updated => { this.members.update(items => items.map(item => item.id === updated.id ? updated : item)); this.successMessage.set('Papel atualizado.'); },
      error: error => this.errorMessage.set(this.errorText(error, 'Não foi possível atualizar o papel.')),
    });
  }
  removeMember(member: CalendarMemberResponse): void {
    if (!this.canManage() || !window.confirm(`Remover ${member.userFullName} deste calendário?`)) return;
    this.clearMessages(); this.actionMemberId.set(member.id);
    this.calendarService.removeMember(member.calendarId, member.id).pipe(finalize(() => this.actionMemberId.set(null))).subscribe({
      next: () => { this.members.update(items => items.filter(item => item.id !== member.id)); this.successMessage.set('Membro removido.'); },
      error: error => this.errorMessage.set(this.errorText(error, 'Não foi possível remover o membro.')),
    });
  }
  isOwner(member: CalendarMemberResponse): boolean { return this.selectedCalendar()?.ownerEmail.toLowerCase() === member.userEmail.toLowerCase(); }
  private loadCalendars(): void {
    this.isLoading.set(true); this.calendarService.list().pipe(finalize(() => this.isLoading.set(false))).subscribe({
      next: calendars => { this.calendars.set(calendars); const id = calendars[0]?.id ?? ''; this.selectedCalendarId.set(id); if (id) this.loadMembers(); },
      error: error => this.errorMessage.set(this.errorText(error, 'Não foi possível carregar os calendários.')),
    });
  }
  private loadMembers(clear = true): void {
    const id = this.selectedCalendarId(); if (!id) { this.members.set([]); return; } if (clear) this.clearMessages(); this.isLoading.set(true);
    this.calendarService.listMembers(id).pipe(finalize(() => this.isLoading.set(false))).subscribe({ next: members => this.members.set(members), error: error => this.errorMessage.set(this.errorText(error, 'Não foi possível carregar os membros.')) });
  }
  private clearMessages(): void { this.errorMessage.set(''); this.successMessage.set(''); }
  private errorText(error: unknown, fallback: string): string { const body = (error as { error?: { detail?: string; message?: string } })?.error; return body?.detail || body?.message || fallback; }
}
