import { TestBed } from '@angular/core/testing';

import { LAYOUT_STORAGE_KEY, LayoutPreferencesService } from './layout-preferences.service';

describe('LayoutPreferencesService', () => {
  afterEach(() => localStorage.removeItem(LAYOUT_STORAGE_KEY));

  function create(stored?: unknown): LayoutPreferencesService {
    if (stored === undefined) {
      localStorage.removeItem(LAYOUT_STORAGE_KEY);
    } else {
      localStorage.setItem(LAYOUT_STORAGE_KEY, typeof stored === 'string' ? stored : JSON.stringify(stored));
    }

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    return TestBed.inject(LayoutPreferencesService);
  }

  it('starts expanded and toggles both regions independently', () => {
    const layout = create();
    expect(layout.sidebarCollapsed()).toBe(false);
    expect(layout.sidePanelCollapsed()).toBe(false);

    layout.toggleSidebar();
    expect(layout.sidebarCollapsed()).toBe(true);
    expect(layout.sidePanelCollapsed()).toBe(false);

    layout.toggleSidePanel();
    expect(layout.sidePanelCollapsed()).toBe(true);
  });

  it('persists the preference across reloads', () => {
    const layout = create();
    layout.setSidebarCollapsed(true);
    layout.setSidePanelCollapsed(true);

    const reloaded = create(localStorage.getItem(LAYOUT_STORAGE_KEY));
    expect(reloaded.sidebarCollapsed()).toBe(true);
    expect(reloaded.sidePanelCollapsed()).toBe(true);
  });

  it('ignores corrupted storage', () => {
    const layout = create('{not json');
    expect(layout.sidebarCollapsed()).toBe(false);
    expect(layout.sidePanelCollapsed()).toBe(false);
  });
});
