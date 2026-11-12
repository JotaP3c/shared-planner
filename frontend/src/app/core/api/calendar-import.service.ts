import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

export interface CalendarImportRequest {
  ical: string;
  sourceCalendarId: string;
  targetCalendarId: string;
  zoneId: string;
  windowStart: string;
  windowEnd: string;
  mappingConfirmed: boolean;
}
export interface CalendarImportResult {
  source: string;
  sourceCalendarId: string;
  targetCalendarId: string;
  rows: Array<{ uid: string; recurrenceId: string | null; title: string; startsAt: string | null; endsAt: string | null; state: 'READY' | 'IMPORTED' | 'DUPLICATE' | 'BLOCKED'; reason: string | null }>;
  imported: number;
  duplicates: number;
  blocked: number;
}
@Injectable({ providedIn: 'root' })
export class CalendarImportService {
  private readonly http = inject(HttpClient);
  preview(request: CalendarImportRequest) { return this.http.post<CalendarImportResult>('/api/calendar-imports/preview', request); }
  commit(request: CalendarImportRequest) { return this.http.post<CalendarImportResult>('/api/calendar-imports/commit', request); }
}
