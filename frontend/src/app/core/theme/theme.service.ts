import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'sharedPlanner.theme';

/**
 * Preferência de tema persistida no navegador. Aplica `data-theme` em <html>;
 * as cores vêm dos tokens CSS em styles/_tokens.scss. Seguro para SSR.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly media = this.isBrowser && typeof matchMedia === 'function'
    ? matchMedia('(prefers-color-scheme: dark)')
    : null;
  private readonly systemPrefersDark = signal(this.media?.matches ?? false);

  readonly preference = signal<ThemePreference>(this.readStoredPreference());
  readonly resolved = computed<ResolvedTheme>(() => {
    const preference = this.preference();
    if (preference === 'system') {
      return this.systemPrefersDark() ? 'dark' : 'light';
    }
    return preference;
  });

  constructor() {
    this.media?.addEventListener('change', event => {
      this.systemPrefersDark.set(event.matches);
      this.apply();
    });
    this.apply();
  }

  setPreference(preference: ThemePreference): void {
    this.preference.set(preference);

    if (this.isBrowser) {
      try {
        localStorage.setItem(STORAGE_KEY, preference);
      } catch {
        // Armazenamento indisponível: a preferência vale só para a sessão atual.
      }
    }

    this.apply();
  }

  toggle(): void {
    this.setPreference(this.resolved() === 'dark' ? 'light' : 'dark');
  }

  private apply(): void {
    if (!this.isBrowser) {
      return;
    }

    const root = this.document.documentElement;
    root.dataset['theme'] = this.resolved();
    root.style.colorScheme = this.resolved();
  }

  private readStoredPreference(): ThemePreference {
    if (!this.isBrowser) {
      return 'system';
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
    } catch {
      return 'system';
    }
  }
}
