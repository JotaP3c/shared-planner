import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';

import { LoginPage } from './login-page';
import { THEME_STORAGE_KEY, ThemeService } from '../../../core/theme/theme.service';

describe('LoginPage', () => {
  let component: LoginPage;
  let fixture: ComponentFixture<LoginPage>;
  let http: HttpTestingController;

  const element = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    localStorage.removeItem(THEME_STORAGE_KEY);
    localStorage.removeItem('sharedPlanner.token');

    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(LoginPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.removeItem(THEME_STORAGE_KEY);
    localStorage.removeItem('sharedPlanner.token');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('does not offer unsupported auth features', () => {
    const text = element().textContent ?? '';

    expect(text).not.toMatch(/Google|Esqueci|Cadastr|Lembrar/i);
    // INC-01: a nota "Acesso protegido por autenticação com token" foi removida.
    expect(text).not.toContain('autenticação com token');
    expect(element().querySelector('.security-note')).toBeNull();
    expect(element().querySelector('img[src*="login-illustration"]')).toBeNull();
    expect(element().querySelector('[data-testid="login-illustration"]')).not.toBeNull();
  });

  it('validates required fields without calling the API', () => {
    component.submit();
    fixture.detectChanges();

    expect(element().querySelector('#login-email-error')?.textContent).toContain('Informe seu e-mail');
    expect(element().querySelector('#login-password-error')?.textContent).toContain('Informe sua senha');
    http.expectNone('/api/auth/login');
  });

  it('logs in, stores the token and navigates to the calendar', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    component.form.setValue({ email: 'ana@example.com', password: 'secret1' });

    component.submit();
    http.expectOne('/api/auth/login').flush({ accessToken: 'token-value', tokenType: 'Bearer' });

    expect(localStorage.getItem('sharedPlanner.token')).toBe('token-value');
    expect(navigate).toHaveBeenCalledWith(['/calendar']);
  });

  it('shows a generic error on invalid credentials', () => {
    component.form.setValue({ email: 'ana@example.com', password: 'wrong' });

    component.submit();
    http.expectOne('/api/auth/login').flush({}, { status: 401, statusText: 'Unauthorized' });
    fixture.detectChanges();

    expect(element().querySelector('[data-testid="login-error"]')?.textContent).toContain('E-mail ou senha inválidos');
    expect(component.isSubmitting).toBe(false);
  });

  it('toggles password visibility with an accessible control', () => {
    const toggle = element().querySelector('.password-toggle') as HTMLButtonElement;
    const input = element().querySelector('#login-password') as HTMLInputElement;

    expect(input.type).toBe('password');
    toggle.click();
    fixture.detectChanges();
    expect(input.type).toBe('text');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
  });

  it('applies light, dark and system themes on the login screen through ThemeService', () => {
    const theme = TestBed.inject(ThemeService);
    const root = document.documentElement;

    (element().querySelector('[data-testid="login-theme-dark"]') as HTMLElement).click();
    expect(root.dataset['theme']).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    (element().querySelector('[data-testid="login-theme-light"]') as HTMLElement).click();
    expect(root.dataset['theme']).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');

    (element().querySelector('[data-testid="login-theme-system"]') as HTMLElement).click();
    fixture.detectChanges();
    expect(theme.preference()).toBe('system');
    expect(['light', 'dark']).toContain(root.dataset['theme']);
    expect(element().querySelector('[data-testid="login-theme-system"]')?.getAttribute('aria-checked')).toBe('true');
  });
});
