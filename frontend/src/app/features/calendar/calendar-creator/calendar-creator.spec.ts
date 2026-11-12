import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CalendarCreator } from './calendar-creator';

describe('CalendarCreator', () => {
  it('creates an explicitly named shared calendar once and emits the authoritative membership', () => {
    TestBed.configureTestingModule({ imports: [CalendarCreator], providers: [provideHttpClient(), provideHttpClientTesting()] });
    const page = TestBed.createComponent(CalendarCreator).componentInstance;
    const http = TestBed.inject(HttpTestingController);
    const created: string[] = []; page.created.subscribe(calendar => created.push(calendar.id));
    page.create(); http.expectNone('/api/calendars');
    page.name.set('  João e Malu  '); page.create(); page.create();
    const request = http.expectOne('/api/calendars');
    expect(request.request.body).toEqual({ name: 'João e Malu' });
    request.flush({ id: 'shared', name: 'João e Malu', calendarType: 'SHARED', memberRole: 'ADMIN', memberRoles: ['ADMIN'], canCreateEvents: true });
    expect(created).toEqual(['shared']); expect(page.saving()).toBe(false);
    http.verify();
  });
});
