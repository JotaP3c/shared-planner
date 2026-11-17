import { SpButtonDirective, SpInputDirective } from '../../../shared/ui/design-system';
import { Component, computed, inject, output, signal } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { canGlobalPermission } from '../../../core/auth/calendar-permissions';
import { CalendarService } from '../../../core/api/calendar.service';
import { CalendarResponse } from '../../../core/models/shared-planner.models';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-calendar-creator',
  imports: [SpButtonDirective, SpInputDirective],
  template: `@if (canCreate()) { <details class="calendar-creator">
    <summary>Novo calendário compartilhado</summary>
    <form (submit)="$event.preventDefault(); create()">
      <label class="sp-field">Nome do calendário
        <input spInput type="text" required maxlength="120" [value]="name()" (input)="name.set($any($event.target).value)" />
      </label>
      <button spButton class="primary-button" type="submit" [disabled]="saving() || !name().trim()">{{ saving() ? 'Criando...' : 'Criar calendário' }}</button>
      <small>Você será administrador. Adicione outros administradores em Membros; isso não concede administração do sistema.</small>
      @if (error()) { <p role="alert">{{ error() }}</p> }
    </form>
  </details> }`,
  styles: `:host { display: block; } details { border: 1px solid var(--sp-border); border-radius: var(--sp-radius); padding: var(--sp-space-3) var(--sp-space-4); background: var(--sp-surface); color: var(--sp-text); font-size: var(--sp-font-size-sm); }
    summary { cursor: pointer; font-weight: var(--sp-font-weight-semibold); } form { display: flex; align-items: end; gap: var(--sp-space-3); flex-wrap: wrap; padding-top: var(--sp-space-3); } small { flex-basis: 100%; color: var(--sp-content-secondary); } p { color: var(--sp-feedback-danger-text); }`,
})
export class CalendarCreator {
  private readonly calendarService = inject(CalendarService);
  private readonly auth = inject(AuthService);
  readonly canCreate = computed(() => canGlobalPermission(this.auth.currentUser(), 'CALENDAR_CREATE'));
  readonly created = output<CalendarResponse>();
  readonly name = signal('');
  readonly saving = signal(false);
  readonly error = signal('');
  create(): void {
    if (!this.canCreate() || this.saving() || !this.name().trim()) return;
    this.saving.set(true); this.error.set('');
    this.calendarService.create({ name: this.name().trim() }).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: calendar => { this.name.set(''); this.created.emit(calendar); },
      error: () => this.error.set('Não foi possível criar o calendário. Confira o nome e tente novamente.'),
    });
  }
}
