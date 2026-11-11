import { TestBed } from '@angular/core/testing';

import { THEME_STORAGE_KEY, ThemeService, parseThemePreference, resolveTheme } from './theme.service';

describe('theme resolution', () => {
  it('explicit preference wins over the system setting', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('system follows the operating system', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });

  it('invalid or missing stored values fall back to system', () => {
    expect(parseThemePreference(null)).toBe('system');
    expect(parseThemePreference('purple')).toBe('system');
    expect(parseThemePreference('dark')).toBe('dark');
  });
});

describe('ThemeService', () => {
  afterEach(() => localStorage.removeItem(THEME_STORAGE_KEY));

  function createService(stored: string | null): ThemeService {
    if (stored === null) {
      localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      localStorage.setItem(THEME_STORAGE_KEY, stored);
    }

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    return TestBed.inject(ThemeService);
  }

  it('restores the persisted preference on startup (refresh / reopen / after logout)', () => {
    const service = createService('dark');

    expect(service.preference()).toBe('dark');
    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });

  it('persists and applies a new preference', () => {
    const service = createService(null);

    service.setPreference('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(document.documentElement.dataset['theme']).toBe('light');

    service.toggle();
    expect(service.preference()).toBe('dark');
    expect(document.documentElement.dataset['theme']).toBe('dark');
  });

  it('keeps tabs in sync when another tab changes the preference', () => {
    const service = createService('light');

    window.dispatchEvent(new StorageEvent('storage', { key: THEME_STORAGE_KEY, newValue: 'dark' }));

    expect(service.preference()).toBe('dark');
    expect(document.documentElement.dataset['theme']).toBe('dark');
  });

  it('keeps the preference in memory when storage fails', () => {
    const service = createService(null);
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });

    service.setPreference('dark');
    expect(service.preference()).toBe('dark');
    expect(document.documentElement.dataset['theme']).toBe('dark');
    setItem.mockRestore();
  });
});
