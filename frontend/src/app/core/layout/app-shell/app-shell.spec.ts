import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { AppShell } from './app-shell';
import { AuthService } from '../../auth/auth.service';

describe('AppShell', () => {
  let component: AppShell;
  let fixture: ComponentFixture<AppShell>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppShell],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AppShell);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows finance navigation only when the effective calendar capability allows it', () => {
    const authService = TestBed.inject(AuthService);
    authService.currentUser.set({
      id: 'user',
      fullName: 'User',
      email: 'user@example.com',
      role: 'USER',
      active: true,
      createdAt: '',
      updatedAt: '',
    });
    component.financeCalendars.set([{
      id: 'viewer-calendar',
      name: 'Viewer calendar',
      ownerEmail: 'owner@example.com',
      memberRole: 'VIEWER',
      canCreateEvents: false,
    }]);
    component.financeAccessResolved.set(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="finance-navigation"]')).toBeNull();

    component.financeCalendars.set([{
      id: 'finance-calendar',
      name: 'Finance calendar',
      ownerEmail: 'owner@example.com',
      memberRole: 'FINANCE',
      canCreateEvents: false,
    }]);
    fixture.detectChanges();

    const navigation: HTMLElement | null = fixture.nativeElement.querySelector(
      '[data-testid="finance-navigation"]',
    );
    expect(navigation).not.toBeNull();
    component.toggleNavGroup('finance');
    fixture.detectChanges();
    expect(navigation?.textContent).toContain('Resumo de receitas');
    expect(navigation?.textContent).not.toContain('Despesas');
    expect(navigation?.textContent).not.toContain('Relatórios');
  });

  it('shows the audit link only to global ADMIN or a calendar ADMIN (BLG-FE-002)', () => {
    const authService = TestBed.inject(AuthService);
    authService.currentUser.set({
      id: 'user', fullName: 'User', email: 'user@example.com', role: 'USER', active: true, createdAt: '', updatedAt: '',
    });
    component.financeCalendars.set([{
      id: 'editor-calendar', name: 'Editor', ownerEmail: 'owner@example.com', memberRole: 'EDITOR', canCreateEvents: true,
    }]);
    component.financeAccessResolved.set(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="audit-navigation"]')).toBeNull();

    component.financeCalendars.set([{
      id: 'admin-calendar', name: 'Admin', ownerEmail: 'user@example.com', memberRole: 'ADMIN', canCreateEvents: true,
    }]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="audit-navigation"]')).not.toBeNull();
  });

  describe('global search (BLG-BUG-007)', () => {
    afterEach(() => vi.useRealTimers());

    it('never shows results of a previous term while the next one is debouncing', () => {
      vi.useFakeTimers();
      const http = TestBed.inject(HttpTestingController);

      component.onSearch('ab');
      vi.advanceTimersByTime(260);
      const previous = http.expectOne(req => req.url === '/api/events/search' && req.params.get('term') === 'ab');

      component.onSearch('abc');
      expect(previous.cancelled).toBe(true);
      expect(component.searchResults()).toEqual([]);
      expect(component.isSearchLoading()).toBe(true);

      vi.advanceTimersByTime(260);
      const current = http.expectOne(req => req.url === '/api/events/search' && req.params.get('term') === 'abc');
      current.flush([{
        id: 'abc', calendarId: 'c', calendarName: 'Agenda', eventType: 'PERSONAL', status: 'SCHEDULED',
        title: 'abc', clientName: null, personName: 'abc', startsAt: '2026-08-24T10:00:00', endsAt: '2026-08-24T11:00:00',
      } as never]);

      expect(component.searchResults().map(result => result.id)).toEqual(['abc']);
      expect(component.isSearchLoading()).toBe(false);
    });
  });
});
