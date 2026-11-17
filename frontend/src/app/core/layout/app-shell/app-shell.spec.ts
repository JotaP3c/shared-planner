import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';

import { AppShell } from './app-shell';
import { AuthService } from '../../auth/auth.service';
import { DataChangeService } from '../../state/data-change.service';
import { EventSearchResponse } from '../../models/shared-planner.models';

@Component({ template: '' })
class TestRoute {}

describe('AppShell', () => {
  let component: AppShell;
  let fixture: ComponentFixture<AppShell>;

  beforeEach(async () => {
    localStorage.removeItem('sharedPlanner.token');
    await TestBed.configureTestingModule({
      imports: [AppShell],
      providers: [provideRouter([{ path: 'test-route', component: TestRoute }]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AppShell);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => { TestBed.inject(HttpTestingController).verify({ ignoreCancelled: true }); localStorage.removeItem('sharedPlanner.token'); });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('closes the mobile navigation on Escape and returns focus to its trigger', async () => {
    const trigger = fixture.nativeElement.querySelector('.menu-button') as HTMLButtonElement;
    trigger.focus();
    component.openSidebar();
    await fixture.whenStable();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    const close = fixture.nativeElement.querySelector('.sidebar-close') as HTMLButtonElement;
    expect(document.activeElement).toBe(close);
    expect(fixture.nativeElement.querySelector('.workspace').hasAttribute('inert')).toBe(true);
    close.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(component.isSidebarOpen()).toBe(false);
    expect(fixture.nativeElement.querySelector('.workspace').hasAttribute('inert')).toBe(false);
    await fixture.whenStable();
    expect(document.activeElement).toBe(trigger);
  });

  it('moves focus inside the profile menu with arrows and restores it on Escape', async () => {
    const trigger = fixture.nativeElement.querySelector('.profile-trigger') as HTMLButtonElement;
    trigger.focus(); trigger.click();
    await fixture.whenStable();
    const choices = fixture.nativeElement.querySelectorAll('.profile-menu [role="menuitemradio"]') as NodeListOf<HTMLButtonElement>;
    expect(document.activeElement).toBe(choices[0]);
    choices[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(choices[1]);
    choices[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(component.showProfileMenu()).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps the ICS title in search without applying an owner-name heuristic to legacy events', () => {
    const imported = { eventType: 'PERSONAL', title: 'Academia', personName: 'Pessoa proprietária', externalSource: 'GOOGLE_ICS' } as EventSearchResponse;
    expect(component.searchResultTitle(imported)).toBe('Academia');
    expect(component.searchResultTitle({ ...imported, externalSource: undefined })).toBe('Pessoa proprietária');
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
      permissions: ['CALENDAR_VIEW'],
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
      permissions: ['CALENDAR_VIEW', 'FINANCE_VIEW'],
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

  it('shows the audit link only for an explicit effective AUDIT_VIEW grant', () => {
    const authService = TestBed.inject(AuthService);
    authService.currentUser.set({
      id: 'user', fullName: 'User', email: 'user@example.com', role: 'USER', active: true, createdAt: '', updatedAt: '',
    });
    component.financeCalendars.set([{
      id: 'editor-calendar', name: 'Editor', ownerEmail: 'owner@example.com', memberRole: 'EDITOR', canCreateEvents: true, permissions: [],
    }]);
    component.financeAccessResolved.set(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="audit-navigation"]')).toBeNull();

    component.financeCalendars.set([{
      id: 'admin-calendar', name: 'Admin', ownerEmail: 'user@example.com', memberRole: 'ADMIN', canCreateEvents: true, permissions: ['AUDIT_VIEW'],
    }]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="audit-navigation"]')).not.toBeNull();
  });

  it('collapses the sidebar to icons, keeps navigation reachable and persists the choice (INC-06)', () => {
    localStorage.removeItem('sharedPlanner.layout');
    component.financeCalendars.set([{ id: 'calendar', name: 'Agenda', ownerEmail: 'owner@example.com', memberRole: 'VIEWER', canCreateEvents: false,
      permissions: ['CALENDAR_VIEW', 'MEMBERS_VIEW'] }]);
    component.financeAccessResolved.set(true);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const toggle = element.querySelector('[data-testid="sidebar-collapse"]') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    toggle.click();
    fixture.detectChanges();

    expect(element.querySelector('.app-shell')?.classList).toContain('sidebar-collapsed');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(element.querySelector('a[aria-label="Calendário"]')?.getAttribute('title')).toBe('Calendário');
    expect(JSON.parse(localStorage.getItem('sharedPlanner.layout') ?? '{}').sidebarCollapsed).toBe(true);

    // Abrir um grupo com a sidebar recolhida expande a navegação (submenus acessíveis).
    component.toggleNavGroup('admin');
    fixture.detectChanges();
    expect(component.sidebarCollapsed()).toBe(false);
    expect(element.textContent).toContain('Membros');
    localStorage.removeItem('sharedPlanner.layout');
  });

  it('refreshes the bell counter after a data change on the same screen', () => {
    const http = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).currentUser.set({
      id: 'user', fullName: 'User', email: 'user@example.com', role: 'USER', active: true, createdAt: '', updatedAt: '',
    });
    localStorage.setItem('sharedPlanner.token', 'test-session');

    TestBed.inject(DataChangeService).notify();
    TestBed.tick();

    http.expectOne('/api/auth/me').flush({ id: 'user', email: 'user@example.com', permissions: [] });
    http.expectOne('/api/calendars').flush([{ id: 'c', name: 'c', permissions: ['EVENT_APPROVE'] }]);

    http.expectOne('/api/events/pending-approvals').flush([
      { id: 'a', status: 'PENDING_APPROVAL', approvalRequestedFromEmail: 'USER@example.com' },
      { id: 'b', status: 'PENDING_APPROVAL', approvalRequestedFromEmail: 'other@example.com' },
    ]);
    expect(component.pendingApprovalCount()).toBe(1);
  });

  it('refreshes access on navigation and cancels a stale permission refresh after a data change', async () => {
    const http = TestBed.inject(HttpTestingController), auth = TestBed.inject(AuthService);
    const user = { id: 'u', fullName: 'Pessoa', email: 'u@example.invalid', role: 'ADMIN' as const, active: true, createdAt: '', updatedAt: '' };
    localStorage.setItem('sharedPlanner.token', 'test-session');
    auth.currentUser.set({ ...user, permissions: ['ROLES_MANAGE', 'SETTINGS_VIEW'] });
    component.financeCalendars.set([{ id: 'c', name: 'c', ownerEmail: user.email, memberRole: 'ADMIN', canCreateEvents: true, permissions: ['FINANCE_VIEW'] }]);
    component.financeAccessResolved.set(true); fixture.detectChanges();
    component.toggleProfileMenu(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="finance-navigation"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.profile-menu a[routerLink="/settings"]')).not.toBeNull();
    TestBed.inject(DataChangeService).notify(); TestBed.tick();
    const stale = http.expectOne('/api/auth/me');
    expect(component.canAccessFinance()).toBe(false);
    await TestBed.inject(Router).navigateByUrl('/test-route');
    expect(stale.cancelled).toBe(true);
    http.expectOne('/api/auth/me').flush({ ...user, permissions: [] });
    http.expectOne('/api/calendars').flush([{ id: 'c', name: 'c', ownerEmail: user.email, memberRole: 'ADMIN', canCreateEvents: false, permissions: [] }]);
    component.toggleProfileMenu();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="finance-navigation"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('.profile-menu a[routerLink="/settings"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="roles-navigation"]')).toBeNull();
    expect(component.pendingApprovalCount()).toBe(0);
    http.expectNone('/api/events/pending-approvals');
  });

  it('hides unresolved menus after an access refresh error while preserving the session', () => {
    const http = TestBed.inject(HttpTestingController), auth = TestBed.inject(AuthService);
    localStorage.setItem('sharedPlanner.token', 'test-session');
    auth.currentUser.set({ id: 'u', fullName: 'Pessoa', email: 'u@example.invalid', role: 'ADMIN', permissions: ['ROLES_MANAGE'], active: true, createdAt: '', updatedAt: '' });
    TestBed.inject(DataChangeService).notify(); TestBed.tick();
    http.expectOne('/api/auth/me').flush({ detail: 'Unavailable' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(auth.getToken()).toBe('test-session');
    expect(component.canManageProfiles()).toBe(false); expect(component.canAccessFinance()).toBe(false);
    http.expectNone('/api/calendars'); http.expectNone('/api/events/pending-approvals');
  });

  it('does not resolve contextual grants when a successful user response has no usable identity', () => {
    const http = TestBed.inject(HttpTestingController);
    localStorage.setItem('sharedPlanner.token', 'test-session');
    TestBed.inject(DataChangeService).notify(); TestBed.tick();
    http.expectOne('/api/auth/me').flush({ permissions: ['ROLES_MANAGE'] });
    expect(component.currentUser()).toBeNull(); expect(component.canViewCalendar()).toBe(false);
    http.expectNone('/api/calendars'); http.expectNone('/api/events/pending-approvals');
  });

  it('updates visible global and contextual modules after explicit grants are revoked', () => {
    const auth = TestBed.inject(AuthService);
    const user = { id: 'user', fullName: 'User', email: 'user@example.invalid', role: 'USER' as const, active: true, createdAt: '', updatedAt: '' };
    auth.currentUser.set({ ...user, permissions: ['ROLES_MANAGE'] });
    component.financeCalendars.set([{ id: 'scope', name: 'Agenda', ownerEmail: user.email, memberRole: 'VIEWER', canCreateEvents: false,
      permissions: ['CALENDAR_VIEW', 'FINANCE_VIEW'] }]);
    component.financeAccessResolved.set(true); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="roles-navigation"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="finance-navigation"]')).not.toBeNull();
    auth.currentUser.set({ ...user, role: 'ADMIN', permissions: [] });
    component.financeCalendars.update(calendars => calendars.map(calendar => ({ ...calendar, permissions: [] })));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="roles-navigation"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="finance-navigation"]')).toBeNull();
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
