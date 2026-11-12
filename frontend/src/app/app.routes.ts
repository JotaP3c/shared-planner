import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { auditAccessGuard, systemAdminGuard } from './core/guards/role.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login-page/login-page').then(
        m => m.LoginPage,
      ),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./core/layout/app-shell/app-shell').then(
        m => m.AppShell,
      ),
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'calendar',
      },
      {
        path: 'calendar',
        loadComponent: () =>
          import('./features/calendar/calendar-page/calendar-page').then(
            m => m.CalendarPage,
          ),
      },
      {
        path: 'pending',
        loadComponent: () =>
          import('./features/pending/pending-page/pending-page').then(
            m => m.PendingPage,
          ),
      },
      {
        path: 'calendar-import',
        loadComponent: () => import('./features/calendar/calendar-import-page/calendar-import-page').then(m => m.CalendarImportPage),
      },
      {
        path: 'finance',
        loadComponent: () =>
          import('./features/finance/finance-page/finance-page').then(
            m => m.FinancePage,
          ),
      },
      {
        path: 'members',
        loadComponent: () =>
          import('./features/members/members-page/members-page').then(
            m => m.MembersPage,
          ),
      },
      {
        path: 'admin/users',
        canActivate: [systemAdminGuard],
        loadComponent: () =>
          import('./features/users/users-page/users-page').then(
            m => m.UsersPage,
          ),
      },
      {
        path: 'audit',
        canActivate: [auditAccessGuard],
        loadComponent: () =>
          import('./features/audit/audit-page/audit-page').then(
            m => m.AuditPage,
          ),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings-page/settings-page').then(
            m => m.SettingsPage,
          ),
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'calendar',
  },
];
