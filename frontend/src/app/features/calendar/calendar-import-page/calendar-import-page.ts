import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { CalendarService } from '../../../core/api/calendar.service';
import { CalendarImportRequest, CalendarImportResult, CalendarImportService } from '../../../core/api/calendar-import.service';
import { CalendarResponse } from '../../../core/models/shared-planner.models';
import { DataChangeService } from '../../../core/state/data-change.service';

@Component({
  selector: 'app-calendar-import-page',
  templateUrl: './calendar-import-page.html',
  styles: `:host { display: block; } .import-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 14px; } .import-panel { padding: 20px; margin-bottom: 18px; } .import-confirm { display: flex; gap: 8px; margin: 18px 0; } .import-actions { display: flex; flex-wrap: wrap; gap: 12px; } .import-summary { color: var(--sp-text-2); }`,
})
export class CalendarImportPage implements OnInit {
  private readonly calendarService = inject(CalendarService);
  private readonly importer = inject(CalendarImportService);
  private readonly changes = inject(DataChangeService);
  private fileRevision = 0;
  readonly calendars = signal<CalendarResponse[]>([]);
  readonly ical = signal('');
  readonly sourceCalendarId = signal('');
  readonly targetCalendarId = signal('');
  readonly zoneId = signal('America/Sao_Paulo');
  readonly windowStart = signal('2026-10-01');
  readonly windowEnd = signal('2026-12-31');
  readonly confirmed = signal(false);
  readonly loading = signal(false);
  readonly result = signal<CalendarImportResult | null>(null);
  readonly error = signal('');
  readonly success = signal('');
  readonly selectedCalendar = computed(() => this.calendars().find(calendar => calendar.id === this.targetCalendarId()));

  ngOnInit(): void {
    this.calendarService.list().subscribe({
      next: calendars => this.calendars.set(calendars.filter(calendar => calendar.canCreateEvents)),
      error: () => this.error.set('Não foi possível carregar os calendários autorizados.'),
    });
  }
  invalidate(): void { this.result.set(null); this.confirmed.set(false); this.success.set(''); }
  async readFile(file: File | undefined): Promise<void> {
    const revision = ++this.fileRevision;
    this.invalidate(); this.ical.set(''); this.error.set('');
    if (!file) return;
    if (!/\.ics$/i.test(file.name) || file.size > 1_000_000) {
      this.error.set('Selecione um arquivo .ics de até 1 MB.'); return;
    }
    try {
      const content = await file.text();
      if (revision === this.fileRevision) this.ical.set(content);
    } catch { this.error.set('Não foi possível ler o arquivo.'); }
  }
  private request(commit: boolean): CalendarImportRequest | null {
    if (!this.ical() || !this.sourceCalendarId().trim() || !this.selectedCalendar()
      || !this.windowStart() || !this.windowEnd() || this.windowStart() > this.windowEnd()) {
      this.error.set('Informe o arquivo, o identificador de origem, o destino autorizado e um intervalo válido.'); return null;
    }
    return { ical: this.ical(), sourceCalendarId: this.sourceCalendarId().trim(), targetCalendarId: this.targetCalendarId(),
      zoneId: this.zoneId(), windowStart: this.windowStart(), windowEnd: this.windowEnd(), mappingConfirmed: commit };
  }
  preview(): void {
    if (this.loading()) return;
    const request = this.request(false); if (!request) return;
    this.loading.set(true); this.error.set(''); this.result.set(null); this.confirmed.set(false); this.success.set('');
    this.importer.preview(request).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: result => this.result.set(result),
      error: () => this.error.set('Não foi possível gerar a prévia. Confira o formato ICS, o intervalo e suas permissões.'),
    });
  }
  commit(): void {
    if (this.loading() || !this.result() || !this.confirmed()) return;
    const request = this.request(true); if (!request) return;
    this.loading.set(true); this.error.set('');
    this.importer.commit(request).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: result => {
        this.result.set(result); this.confirmed.set(false);
        this.success.set(`Importação concluída: ${result.imported} importado(s), ${result.duplicates} duplicado(s), ${result.blocked} bloqueado(s).`);
        this.changes.notify();
      },
      error: () => this.error.set('Não foi possível concluir a importação. Nenhum destino alternativo será utilizado.'),
    });
  }
  stateLabel(state: string): string {
    return ({ READY: 'Pronto', IMPORTED: 'Importado', DUPLICATE: 'Já importado', BLOCKED: 'Bloqueado' } as Record<string, string>)[state] ?? state;
  }
}
