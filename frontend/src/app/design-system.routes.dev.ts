import { isDevMode } from '@angular/core';
import { Routes } from '@angular/router';

// Angular CLI replaces the empty route list only in the development configuration.
export const DESIGN_SYSTEM_ROUTES: Routes = [
  {
    path: 'design-system',
    canMatch: [() => isDevMode()],
    title: 'Design System · Shared Planner',
    loadComponent: () => import('./features/design-system/design-system-page').then(m => m.DesignSystemPage),
  },
];
