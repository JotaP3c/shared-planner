import { Component, computed, inject } from '@angular/core';

import { AuthService } from '../../../core/auth/auth.service';
import { ThemePreference, ThemeService } from '../../../core/theme/theme.service';
import { Icon, IconName } from '../../../shared/ui/icon/icon';
import { SpBadge, SpCard, SpEmptyState } from '../../../shared/ui/design-system';

@Component({
  selector: 'app-settings-page',
  imports: [Icon, SpBadge, SpCard, SpEmptyState],
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.scss',
})
export class SettingsPage {
  private readonly authService = inject(AuthService);
  private readonly themeService = inject(ThemeService);

  readonly currentUser = this.authService.currentUser;
  readonly preference = this.themeService.preference;
  readonly resolvedTheme = this.themeService.resolved;

  readonly themeOptions: ReadonlyArray<{ value: ThemePreference; label: string; hint: string; icon: IconName }> = [
    { value: 'light', label: 'Claro', hint: 'Sempre usa o tema claro.', icon: 'sun' },
    { value: 'dark', label: 'Escuro', hint: 'Sempre usa o tema escuro.', icon: 'moon' },
    { value: 'system', label: 'Sistema', hint: 'Acompanha a preferência do dispositivo.', icon: 'monitor' },
  ];

  readonly roleLabel = computed(() => {
    const labels: Record<string, string> = { ADMIN: 'Administrador', FINANCE: 'Financeiro', USER: 'Usuário' };
    const role = this.currentUser()?.role;
    return role ? labels[role] ?? role : '';
  });

  setTheme(preference: ThemePreference): void {
    this.themeService.setPreference(preference);
  }

  onThemeKeydown(event: KeyboardEvent, index: number): void {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? this.themeOptions.length - 1
      : (index + (['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1) + this.themeOptions.length) % this.themeOptions.length;
    this.setTheme(this.themeOptions[next].value);
    (event.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
  }
}
