import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { auditAccessGuard, permissionGuard, systemAdminGuard } from './core/guards/role.guard';
import { DESIGN_SYSTEM_ROUTES } from './design-system.routes';

export const routes: Routes = [
  ...DESIGN_SYSTEM_ROUTES,
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
        canActivate: [permissionGuard('CALENDAR_VIEW', true)],
        loadComponent: () =>
          import('./features/calendar/calendar-page/calendar-page').then(
            m => m.CalendarPage,
          ),
      },
      {
        path: 'pending',
        canActivate: [permissionGuard('EVENT_APPROVE', true)],
        loadComponent: () =>
          import('./features/pending/pending-page/pending-page').then(
            m => m.PendingPage,
          ),
      },
      {
        path: 'calendar-import',
        canActivate: [permissionGuard('CALENDAR_IMPORT', true)],
        loadComponent: () => import('./features/calendar/calendar-import-page/calendar-import-page').then(m => m.CalendarImportPage),
      },
      {
        path: 'finance/catalog',
        canActivate: [permissionGuard('CATALOG_VIEW', true)],
        loadComponent: () => import('./features/catalog/catalog-page').then(m => m.CatalogPage),
      },
      {
        path: 'finance',
        canActivate: [permissionGuard('FINANCE_VIEW', true)],
        loadComponent: () =>
          import('./features/finance/finance-page/finance-page').then(
            m => m.FinancePage,
          ),
      },
      {
        path: 'members',
        canActivate: [permissionGuard('MEMBERS_VIEW', true)],
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
        path: 'admin/roles',
        canActivate: [permissionGuard('ROLES_MANAGE')],
        loadComponent: () => import('./features/access/access-page').then(m => m.AccessPage),
      },
      {
        path: 'access-denied',
        loadComponent: () => import('./features/access/access-denied').then(m => m.AccessDenied),
      },
      {
        path: 'settings',
        canActivate: [permissionGuard('SETTINGS_VIEW')],
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
