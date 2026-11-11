import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { DestroyRef, Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

/** Chave única de persistência. O script pré-pintura de index.html usa a mesma chave. */
export const THEME_STORAGE_KEY = 'sharedPlanner.theme';

export function parseThemePreference(value: unknown): ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
}

/**
 * Resolvedor único do tema efetivo. A mesma regra está replicada (em JS puro) no script
 * pré-pintura de index.html: preferência explícita vence; "system"/ausente segue o SO.
 */
export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (preference === 'system') {
    return systemPrefersDark ? 'dark' : 'light';
  }

  return preference;
}

/**
 * Fonte única do tema para todas as rotas (login, shell, configurações). Aplica
 * `data-theme` e `color-scheme` em <html>; as cores vêm dos tokens em styles/_tokens.scss.
 * Seguro para SSR (não toca em globals do navegador no servidor).
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
  readonly resolved = computed<ResolvedTheme>(() =>
    resolveTheme(this.preference(), this.systemPrefersDark()),
  );

  constructor() {
    const onSystemChange = (event: MediaQueryListEvent) => {
      this.systemPrefersDark.set(event.matches);
      this.apply();
    };

    // Outra aba alterou a preferência: mantém todas as abas consistentes.
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) {
        this.preference.set(parseThemePreference(event.newValue));
        this.apply();
      }
    };

    this.media?.addEventListener('change', onSystemChange);

    if (this.isBrowser) {
      window.addEventListener('storage', onStorage);
    }

    inject(DestroyRef).onDestroy(() => {
      this.media?.removeEventListener('change', onSystemChange);

      if (this.isBrowser) {
        window.removeEventListener('storage', onStorage);
      }
    });

    this.apply();
  }

  setPreference(preference: ThemePreference): void {
    this.preference.set(parseThemePreference(preference));

    if (this.isBrowser) {
      try {
        localStorage.setItem(THEME_STORAGE_KEY, this.preference());
      } catch {
        // Armazenamento indisponível: a preferência vale só em memória nesta sessão.
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
      return parseThemePreference(localStorage.getItem(THEME_STORAGE_KEY));
    } catch {
      return 'system';
    }
  }
}
