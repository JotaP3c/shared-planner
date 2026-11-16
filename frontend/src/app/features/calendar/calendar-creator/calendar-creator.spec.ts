import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CalendarCreator } from './calendar-creator';
import { AuthService } from '../../../core/auth/auth.service';

describe('CalendarCreator', () => {
  it('creates an explicitly named shared calendar once and emits the authoritative membership', () => {
    TestBed.configureTestingModule({ imports: [CalendarCreator], providers: [provideHttpClient(), provideHttpClientTesting()] });
    const page = TestBed.createComponent(CalendarCreator).componentInstance;
    TestBed.inject(AuthService).currentUser.set({ id: 'person', email: 'person@example.invalid', fullName: 'Pessoa', role: 'USER', active: true,
      createdAt: '', updatedAt: '', permissions: ['CALENDAR_CREATE'] });
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

  it('does not create a calendar when an otherwise administrative user lacks an explicit creation grant', () => {
    TestBed.configureTestingModule({ imports: [CalendarCreator], providers: [provideHttpClient(), provideHttpClientTesting()] });
    const fixture = TestBed.createComponent(CalendarCreator);
    TestBed.inject(AuthService).currentUser.set({ id: 'person', email: 'person@example.invalid', fullName: 'Pessoa', role: 'ADMIN', active: true,
      createdAt: '', updatedAt: '', permissions: [] });
    fixture.componentInstance.name.set('Calendário de teste');
    fixture.componentInstance.create(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    TestBed.inject(HttpTestingController).expectNone('/api/calendars');
  });
});
