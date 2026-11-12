import { TestBed } from '@angular/core/testing';
import { RecurrenceEditor } from './recurrence-editor';
import { RecurrenceRequest } from '../../../core/models/shared-planner.models';

describe('RecurrenceEditor', () => {
  it('produces a bounded Monday/Wednesday series in the explicit civil timezone', () => {
    const fixture = TestBed.createComponent(RecurrenceEditor);
    const editor = fixture.componentInstance;
    let value: RecurrenceRequest | null = null;
    editor.changed.subscribe(request => value = request);
    editor.setFrequency('WEEKLY');
    editor.toggleDay('MONDAY'); editor.toggleDay('WEDNESDAY');
    editor.until.set('2026-12-31'); editor.emit();
    expect(value).toEqual({ frequency: 'WEEKLY', interval: 1, weekDays: ['MONDAY', 'WEDNESDAY'], until: '2026-12-31', count: undefined, zoneId: 'America/Sao_Paulo' });
    editor.setFrequency(''); expect(value).toBeNull();
  });
});
