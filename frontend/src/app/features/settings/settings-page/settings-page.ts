import { Component, computed, inject } from '@angular/core';

import { AuthService } from '../../../core/auth/auth.service';
import { ThemePreference, ThemeService } from '../../../core/theme/theme.service';

@Component({
  selector: 'app-settings-page',
  imports: [],
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.scss',
})
export class SettingsPage {
  private readonly authService = inject(AuthService);
  private readonly themeService = inject(ThemeService);

  readonly currentUser = this.authService.currentUser;
  readonly preference = this.themeService.preference;
  readonly resolvedTheme = this.themeService.resolved;

  readonly themeOptions: ReadonlyArray<{ value: ThemePreference; label: string; hint: string }> = [
    { value: 'light', label: 'Claro', hint: 'Sempre usa o tema claro.' },
    { value: 'dark', label: 'Escuro', hint: 'Sempre usa o tema escuro.' },
    { value: 'system', label: 'Sistema', hint: 'Acompanha a preferência do dispositivo.' },
  ];

  readonly roleLabel = computed(() => {
    const labels: Record<string, string> = { ADMIN: 'Administrador', FINANCE: 'Financeiro', USER: 'Usuário' };
    const role = this.currentUser()?.role;
    return role ? labels[role] ?? role : '';
  });

  setTheme(preference: ThemePreference): void {
    this.themeService.setPreference(preference);
  }
}
