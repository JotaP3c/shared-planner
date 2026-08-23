import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
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
});
