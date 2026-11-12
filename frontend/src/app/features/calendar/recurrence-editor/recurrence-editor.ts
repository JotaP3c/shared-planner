import { Component, output, signal } from '@angular/core';
import { RecurrenceRequest } from '../../../core/models/shared-planner.models';

@Component({
  selector: 'app-recurrence-editor',
  template: `
    <fieldset class="recurrence-editor">
      <legend>Repetição</legend>
      <label class="sp-field">Frequência
        <select aria-label="Frequência de repetição" (change)="setFrequency($any($event.target).value)">
          <option value="">Não repetir</option>
          @for (option of frequencies; track option.value) { <option [value]="option.value">{{ option.label }}</option> }
        </select>
      </label>
      @if (frequency()) {
        <div class="form-row two">
          <label class="sp-field">Até a data (inclusive)
            <input type="date" [value]="until()" (input)="until.set($any($event.target).value); emit()" />
          </label>
          <label class="sp-field">Ou quantidade (máximo 366)
            <input type="number" min="1" max="366" [value]="count()" (input)="count.set($any($event.target).value); emit()" />
          </label>
        </div>
        @if (frequency() === 'WEEKLY' || frequency() === 'CUSTOM') {
          @if (frequency() === 'CUSTOM') {
            <label class="sp-field">Intervalo em semanas
              <input type="number" min="1" max="52" [value]="interval()" (input)="interval.set(+$any($event.target).value); emit()" />
            </label>
          }
          <div class="weekday-options" role="group" aria-label="Dias da semana">
            @for (day of days; track day.value) {
              <label><input type="checkbox" [checked]="weekDays().includes(day.value)" (change)="toggleDay(day.value)" /> {{ day.label }}</label>
            }
          </div>
        }
        <p class="field-hint">Horários de America/Sao_Paulo. Informe uma data limite ou quantidade; até 366 ocorrências em três anos.</p>
      }
    </fieldset>
  `,
  styles: `fieldset { margin: 0; padding: 12px; border: 1px solid var(--sp-border); border-radius: var(--sp-radius); display: grid; gap: 12px; }
    legend { font-size: 13px; font-weight: 700; } .weekday-options { display: flex; flex-wrap: wrap; gap: 10px; font-size: 12px; }`,
})
export class RecurrenceEditor {
  readonly changed = output<RecurrenceRequest | null>();
  readonly frequency = signal<RecurrenceRequest['frequency'] | ''>('');
  readonly until = signal('');
  readonly count = signal('');
  readonly interval = signal(1);
  readonly weekDays = signal<string[]>([]);
  readonly frequencies = [
    { value: 'DAILY', label: 'Diária' }, { value: 'WEEKLY', label: 'Semanal' },
    { value: 'BIWEEKLY', label: 'Quinzenal' }, { value: 'MONTHLY', label: 'Mensal' },
    { value: 'CUSTOM', label: 'Personalizada' },
  ];
  readonly days = [
    { value: 'MONDAY', label: 'Seg' }, { value: 'TUESDAY', label: 'Ter' },
    { value: 'WEDNESDAY', label: 'Qua' }, { value: 'THURSDAY', label: 'Qui' },
    { value: 'FRIDAY', label: 'Sex' }, { value: 'SATURDAY', label: 'Sáb' }, { value: 'SUNDAY', label: 'Dom' },
  ];
  setFrequency(value: RecurrenceRequest['frequency'] | '') { this.frequency.set(value); this.emit(); }
  toggleDay(day: string) {
    this.weekDays.update(days => days.includes(day) ? days.filter(item => item !== day) : [...days, day]);
    this.emit();
  }
  emit() {
    const frequency = this.frequency();
    this.changed.emit(frequency ? {
      frequency, zoneId: 'America/Sao_Paulo', interval: this.interval(),
      weekDays: this.weekDays(), until: this.until() || undefined,
      count: this.count() ? Number(this.count()) : undefined,
    } : null);
  }
}
