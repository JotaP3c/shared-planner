import { Component, inject, output, signal } from '@angular/core';
import { CalendarService } from '../../../core/api/calendar.service';
import { CalendarResponse } from '../../../core/models/shared-planner.models';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-calendar-creator',
  template: `<details class="calendar-creator">
    <summary>Novo calendário compartilhado</summary>
    <form (submit)="$event.preventDefault(); create()">
      <label class="sp-field">Nome do calendário
        <input type="text" required maxlength="120" [value]="name()" (input)="name.set($any($event.target).value)" />
      </label>
      <button class="primary-button" type="submit" [disabled]="saving() || !name().trim()">{{ saving() ? 'Criando...' : 'Criar calendário' }}</button>
      <small>Você será administrador. Adicione outros administradores em Membros; isso não concede administração do sistema.</small>
      @if (error()) { <p role="alert">{{ error() }}</p> }
    </form>
  </details>`,
  styles: `:host { display: block; } details { border: 1px solid var(--sp-border); border-radius: 10px; padding: 10px 14px; background: var(--sp-surface); color: var(--sp-text); font-size: 13px; }
    summary { cursor: pointer; font-weight: 650; } form { display: flex; align-items: end; gap: 12px; flex-wrap: wrap; padding-top: 12px; } small { flex-basis: 100%; color: var(--sp-text-2); } p { color: var(--sp-danger); }`,
})
export class CalendarCreator {
  private readonly calendarService = inject(CalendarService);
  readonly created = output<CalendarResponse>();
  readonly name = signal('');
  readonly saving = signal(false);
  readonly error = signal('');
  create(): void {
    if (this.saving() || !this.name().trim()) return;
    this.saving.set(true); this.error.set('');
    this.calendarService.create({ name: this.name().trim() }).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: calendar => { this.name.set(''); this.created.emit(calendar); },
      error: () => this.error.set('Não foi possível criar o calendário. Confira o nome e tente novamente.'),
    });
  }
}
