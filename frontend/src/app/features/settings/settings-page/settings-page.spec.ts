import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { SettingsPage } from './settings-page';
import { AuthService } from '../../../core/auth/auth.service';
import { ThemeService } from '../../../core/theme/theme.service';

describe('SettingsPage', () => {
  let component: SettingsPage;
  let fixture: ComponentFixture<SettingsPage>;

  beforeEach(async () => {
    localStorage.removeItem('sharedPlanner.theme');
    await TestBed.configureTestingModule({
      imports: [SettingsPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    TestBed.inject(AuthService).currentUser.set({
      id: 'u', fullName: 'Maria Souza', email: 'maria@example.com', role: 'FINANCE', active: true, createdAt: '', updatedAt: '',
    });
    fixture = TestBed.createComponent(SettingsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => localStorage.removeItem('sharedPlanner.theme'));

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows read-only identity data', () => {
    const info = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="account-info"]')?.textContent ?? '';

    expect(info).toContain('Maria Souza');
    expect(info).toContain('maria@example.com');
    expect(info).toContain('Financeiro');
    expect((fixture.nativeElement as HTMLElement).querySelector('input')).toBeNull();
  });

  it('applies and persists the theme through the shared ThemeService', () => {
    const theme = TestBed.inject(ThemeService);

    (fixture.nativeElement.querySelector('[data-testid="theme-dark"]') as HTMLElement).click();
    fixture.detectChanges();

    expect(theme.preference()).toBe('dark');
    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(localStorage.getItem('sharedPlanner.theme')).toBe('dark');
    expect(fixture.nativeElement.querySelector('[data-testid="theme-dark"]').getAttribute('aria-checked')).toBe('true');

    (fixture.nativeElement.querySelector('[data-testid="theme-light"]') as HTMLElement).click();
    expect(document.documentElement.dataset['theme']).toBe('light');
  });
});
