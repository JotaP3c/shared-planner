import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { ThemePreference, ThemeService } from '../../../core/theme/theme.service';
import { Icon, IconName } from '../../../shared/ui/icon/icon';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, Icon],
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss',
})
export class LoginPage {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  private readonly themeService = inject(ThemeService);

  isSubmitting = false;
  errorMessage = '';
  readonly showPassword = signal(false);
  /** Mesma preferência do shell e das Configurações (ThemeService é a fonte única). */
  readonly themePreference = this.themeService.preference;
  readonly themeOptions: ReadonlyArray<{ value: ThemePreference; label: string; icon: IconName }> = [
    { value: 'light', label: 'claro', icon: 'sun' },
    { value: 'dark', label: 'escuro', icon: 'moon' },
    { value: 'system', label: 'do sistema', icon: 'monitor' },
  ];

  setTheme(preference: ThemePreference): void {
    this.themeService.setPreference(preference);
  }

  // "Lembrar de mim", "Esqueci minha senha", Google e cadastro foram removidos:
  // não há suporte no backend e a UI não deve sugerir funções inexistentes.
  form = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  get emailError(): string {
    const control = this.form.controls.email;

    if (!control.touched || control.valid) {
      return '';
    }

    return control.hasError('required') ? 'Informe seu e-mail.' : 'Informe um e-mail válido.';
  }

  get passwordError(): string {
    const control = this.form.controls.password;
    return control.touched && control.hasError('required') ? 'Informe sua senha.' : '';
  }

  togglePasswordVisibility(): void {
    this.showPassword.update(visible => !visible);
  }

  submit(): void {
    if (this.form.invalid || this.isSubmitting) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    const { email, password } = this.form.getRawValue();

    this.authService.login({ email, password }).subscribe({
      next: () => this.router.navigate(['/calendar']),
      error: () => {
        this.errorMessage = 'E-mail ou senha inválidos.';
        this.isSubmitting = false;
      },
    });
  }
}
