import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';

export const LAYOUT_STORAGE_KEY = 'sharedPlanner.layout';

interface StoredLayout {
  sidebarCollapsed?: unknown;
  sidePanelCollapsed?: unknown;
}

/**
 * Preferências visuais do layout (INC-06): sidebar esquerda e painel direito do
 * calendário recolhíveis de forma independente, persistidos por navegador. SSR-safe.
 */
@Injectable({ providedIn: 'root' })
export class LayoutPreferencesService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly stored = this.read();

  readonly sidebarCollapsed = signal(this.stored.sidebarCollapsed === true);
  readonly sidePanelCollapsed = signal(this.stored.sidePanelCollapsed === true);

  toggleSidebar(): void {
    this.setSidebarCollapsed(!this.sidebarCollapsed());
  }

  setSidebarCollapsed(collapsed: boolean): void {
    this.sidebarCollapsed.set(collapsed);
    this.persist();
  }

  toggleSidePanel(): void {
    this.setSidePanelCollapsed(!this.sidePanelCollapsed());
  }

  setSidePanelCollapsed(collapsed: boolean): void {
    this.sidePanelCollapsed.set(collapsed);
    this.persist();
  }

  private persist(): void {
    if (!this.isBrowser) {
      return;
    }

    try {
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify({
        sidebarCollapsed: this.sidebarCollapsed(),
        sidePanelCollapsed: this.sidePanelCollapsed(),
      }));
    } catch {
      // Sem armazenamento: a preferência vale apenas nesta sessão.
    }
  }

  private read(): StoredLayout {
    if (!this.isBrowser) {
      return {};
    }

    try {
      const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed as StoredLayout : {};
    } catch {
      return {};
    }
  }
}
