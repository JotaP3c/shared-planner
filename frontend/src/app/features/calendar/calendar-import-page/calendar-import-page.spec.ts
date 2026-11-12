import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CalendarImportPage } from './calendar-import-page';

describe('CalendarImportPage', () => {
  it('requires a preview and explicit authorized mapping before committing, then reports duplicates', async () => {
    TestBed.configureTestingModule({ imports: [CalendarImportPage], providers: [provideHttpClient(), provideHttpClientTesting()] });
    const fixture = TestBed.createComponent(CalendarImportPage);
    const page = fixture.componentInstance;
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne('/api/calendars').flush([
      { id: 'mine', name: 'Minha agenda', ownerEmail: 'me@example.test', memberRole: 'ADMIN', canCreateEvents: true },
      { id: 'viewer', name: 'Somente leitura', memberRole: 'VIEWER', canCreateEvents: false },
    ]);
    expect(page.calendars().map(calendar => calendar.id)).toEqual(['mine']);
    await page.readFile({ name: 'calendar.ics', size: 40, text: async () => 'BEGIN:VCALENDAR\nEND:VCALENDAR' } as File);
    expect(page.ical()).toContain('BEGIN:VCALENDAR');
    page.sourceCalendarId.set('authorized-source'); page.targetCalendarId.set('mine');
    page.commit(); http.expectNone('/api/calendar-imports/commit');
    page.preview();
    const request = http.expectOne('/api/calendar-imports/preview');
    expect(request.request.body.mappingConfirmed).toBe(false);
    expect(request.request.body.targetCalendarId).toBe('mine');
    const preview = { source: 'GOOGLE_ICS', sourceCalendarId: 'authorized-source', targetCalendarId: 'mine', rows: [], imported: 0, duplicates: 0, blocked: 0 };
    request.flush(preview);
    page.commit(); http.expectNone('/api/calendar-imports/commit');
    page.confirmed.set(true); page.commit();
    const commit = http.expectOne('/api/calendar-imports/commit');
    expect(commit.request.body.mappingConfirmed).toBe(true);
    commit.flush({ ...preview, duplicates: 1 });
    expect(page.success()).toContain('1 duplicado');
    page.invalidate(); expect(page.result()).toBeNull(); expect(page.confirmed()).toBe(false);
    http.verify();
  });

  it('rejects screenshots as an import source instead of inventing event times', async () => {
    TestBed.configureTestingModule({ imports: [CalendarImportPage], providers: [provideHttpClient(), provideHttpClientTesting()] });
    const fixture = TestBed.createComponent(CalendarImportPage);
    await fixture.componentInstance.readFile(new File(['image'], 'month.png'));
    expect(fixture.componentInstance.error()).toContain('.ics');
    expect(fixture.componentInstance.ical()).toBe('');
  });
});
