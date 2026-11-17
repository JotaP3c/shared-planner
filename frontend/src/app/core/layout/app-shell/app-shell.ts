import { Component, DestroyRef, ElementRef, Injector, afterNextRender, computed, effect, inject, OnDestroy, OnInit, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Subscription, catchError, filter, finalize, of, switchMap } from 'rxjs';
import { CalendarService } from '../../api/calendar.service';
import { EventService } from '../../api/event.service';
import { AuthService } from '../../auth/auth.service';
import { financeAuthorizedCalendars } from '../../auth/finance-access';
import { canRespondToApproval, canCalendarPermission, canGlobalPermission } from '../../auth/calendar-permissions';
import { Permission } from '../../models/access.models';
import { SearchService } from '../../api/search.service';
import { CalendarResponse, EventSearchResponse, EventType } from '../../models/shared-planner.models';
import { DataChangeService } from '../../state/data-change.service';
import { LayoutPreferencesService } from '../layout-preferences.service';
import { ThemePreference, ThemeService } from '../../theme/theme.service';
import { Icon } from '../../../shared/ui/icon/icon';
import { SpButtonDirective, SpInputDirective, SpTooltip } from '../../../shared/ui/design-system';

@Component({
  selector: 'app-app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, SpButtonDirective, SpInputDirective, SpTooltip],
  host: { '(document:keydown.escape)': 'onEscape()' },
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
})
export class AppShell implements OnInit, OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private sidebarReturnFocus: HTMLElement | null = null;
  private readonly authService = inject(AuthService);
  private readonly calendarService = inject(CalendarService);
  private readonly searchService = inject(SearchService);
  private readonly eventService = inject(EventService);
  private readonly router = inject(Router);
  private readonly themeService = inject(ThemeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dataChanges = inject(DataChangeService);
  private readonly layout = inject(LayoutPreferencesService);
  private pendingCountSubscription: Subscription | null = null;
  private accessSubscription: Subscription | null = null;
  private accessRequestId = 0;
  private searchDebounceId: ReturnType<typeof setTimeout> | null = null;
  private searchRequestId = 0;
  private searchSubscription: Subscription | null = null;

  readonly currentUser = this.authService.currentUser;
  readonly searchTerm = this.searchService.term;
  readonly searchResults = signal<EventSearchResponse[]>([]);
  readonly isSearchPanelOpen = signal(false);
  readonly isSearchLoading = signal(false);
  readonly searchError = signal('');

  readonly userInitials = computed(() => {
    const user = this.currentUser();
    if (!user) return 'SP';
    const displayName = user.fullName?.trim() || user.email?.split('@')[0] || 'Shared Planner';
    const parts = displayName.split(' ').filter(Boolean);

    if (!parts.length) {
      return 'SP';
    }

    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  });

  readonly isAdmin = computed(() => this.financeAccessResolved() && canGlobalPermission(this.currentUser(), 'USERS_VIEW'));
  readonly canManageProfiles = computed(() => this.financeAccessResolved() && canGlobalPermission(this.currentUser(), 'ROLES_MANAGE'));
  readonly canViewSettings = computed(() => this.financeAccessResolved() && canGlobalPermission(this.currentUser(), 'SETTINGS_VIEW'));
  readonly canViewCalendar = computed(() => this.hasContextPermission('CALENDAR_VIEW'));
  readonly canApprove = computed(() => this.hasContextPermission('EVENT_APPROVE'));
  readonly canViewMembers = computed(() => this.hasContextPermission('MEMBERS_VIEW'));
  readonly canImportCalendar = computed(() => this.hasContextPermission('CALENDAR_IMPORT'));
  readonly financeCalendars = signal<CalendarResponse[]>([]);
  readonly financeAccessResolved = signal(false);
  readonly canAccessFinance = computed(() => {
    if (!this.financeAccessResolved()) {
      return false;
    }

    const user = this.currentUser();

    if (!user) {
      return false;
    }

    return financeAuthorizedCalendars(user, this.financeCalendars()).length > 0;
  });

  // Mesmos grants globais/contextuais do auditAccessGuard.
  readonly canAccessAudit = computed(() => {
    if (!this.financeAccessResolved()) {
      return false;
    }

    const user = this.currentUser();

    if (!user) {
      return false;
    }

    return canGlobalPermission(user, 'AUDIT_VIEW_ALL') || this.hasContextPermission('AUDIT_VIEW');
  });

  /** Gestão restrita aos calendários cujo grant efetivo permite gerenciar membros. */
  readonly canManageMembers = computed(() => this.hasContextPermission('MEMBERS_MANAGE'));

  private hasContextPermission(permission: Permission): boolean {
    return this.financeAccessResolved() && this.financeCalendars().some(calendar => canCalendarPermission(calendar, permission));
  }

  readonly roleLabel = computed(() => {
    const labels: Record<string, string> = { ADMIN: 'Administrador', FINANCE: 'Financeiro', USER: 'Usuário' };
    const role = this.currentUser()?.role;
    return role ? labels[role] ?? role : '';
  });

  /** Aprovações SHARED que aguardam o usuário atual (dado real de /api/events/pending-approvals). */
  readonly pendingApprovalCount = signal(0);
  readonly isSidebarOpen = signal(false);
  readonly themePreference = this.themeService.preference;
  readonly resolvedTheme = this.themeService.resolved;

  readonly sidebarCollapsed = this.layout.sidebarCollapsed;
  readonly openNavGroups = signal<Set<string>>(new Set(['admin']));
  readonly showProfileMenu = signal(false);

  constructor() {
    // Aprovar/reprovar/criar/editar evento muda o contador do sino sem exigir navegação.
    let lastSeenVersion = this.dataChanges.version();
    effect(() => {
      const version = this.dataChanges.version();
      if (version !== lastSeenVersion) {
        lastSeenVersion = version;
        untracked(() => this.refreshAccess());
      }
    });
  }

  openSidebar(): void {
    this.sidebarReturnFocus = this.host.nativeElement.ownerDocument.activeElement as HTMLElement | null;
    this.isSidebarOpen.set(true);
    afterNextRender(() => {
      // The drawer starts visibility:hidden; focus after its visible style is painted.
      this.host.nativeElement.ownerDocument.defaultView?.requestAnimationFrame(() => {
        if (this.isSidebarOpen()) this.host.nativeElement.querySelector<HTMLButtonElement>('.sidebar-close')?.focus();
      });
    }, { injector: this.injector });
  }

  closeSidebar(): void {
    const wasOpen = this.isSidebarOpen();
    this.isSidebarOpen.set(false);
    const returnTarget = this.sidebarReturnFocus;
    if (wasOpen) afterNextRender(() => {
      if (!this.isSidebarOpen() && returnTarget?.isConnected) returnTarget.focus();
    }, { injector: this.injector });
  }

  onSidebarKeydown(event: KeyboardEvent): void {
    if (!this.isSidebarOpen() || event.key !== 'Tab') return;
    const sidebar = event.currentTarget as HTMLElement;
    const controls = Array.from(sidebar.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)'))
      .filter(element => element.getAttribute('tabindex') !== '-1' && element.ownerDocument.defaultView?.getComputedStyle(element).visibility !== 'hidden');
    if (!controls.length) return;
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && sidebar.ownerDocument.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && sidebar.ownerDocument.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  onEscape(): void {
    if (this.showProfileMenu()) this.closeProfileMenu(true);
    if (this.isSidebarOpen()) this.closeSidebar();
  }

  focusWorkspace(): void {
    this.host.nativeElement.querySelector<HTMLElement>('.content')?.focus();
  }

  setTheme(preference: ThemePreference): void {
    this.themeService.setPreference(preference);
  }

  toggleTheme(): void {
    this.themeService.toggle();
  }

  typeClass(eventType: EventType): string {
    return eventType.toLowerCase();
  }

  toggleSidebarCollapsed(): void {
    this.layout.toggleSidebar();
  }

  toggleNavGroup(group: string): void {
    // Recolhida, a sidebar mostra só ícones: abrir um grupo expande a navegação para
    // que os submenus continuem acessíveis.
    if (this.sidebarCollapsed()) {
      this.layout.setSidebarCollapsed(false);
      this.openNavGroups.set(new Set([...this.openNavGroups(), group]));
      return;
    }

    const groups = new Set(this.openNavGroups());

    if (groups.has(group)) {
      groups.delete(group);
    } else {
      groups.add(group);
    }

    this.openNavGroups.set(groups);
  }

  isNavGroupOpen(group: string): boolean {
    return this.openNavGroups().has(group);
  }

  toggleProfileMenu(): void {
    this.showProfileMenu.set(!this.showProfileMenu());
    if (this.showProfileMenu()) afterNextRender(() => this.profileMenuItems()[0]?.focus(), { injector: this.injector });
  }

  closeProfileMenu(restoreFocus = false): void {
    this.showProfileMenu.set(false);
    if (restoreFocus) this.host.nativeElement.querySelector<HTMLButtonElement>('.profile-trigger')?.focus();
  }

  onProfileMenuKeydown(event: KeyboardEvent): void {
    const items = this.profileMenuItems();
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); this.closeProfileMenu(true); return; }
    if (event.key === 'Tab') { this.closeProfileMenu(true); return; }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) || !items.length) return;
    event.preventDefault();
    const current = items.findIndex(item => item === this.host.nativeElement.ownerDocument.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
      : (current + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length;
    items[next].focus();
  }

  onProfileTriggerKeydown(event: KeyboardEvent): void {
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    this.showProfileMenu.set(true);
    afterNextRender(() => {
      const items = this.profileMenuItems();
      (event.key === 'ArrowUp' ? items.at(-1) : items[0])?.focus();
    }, { injector: this.injector });
  }

  private profileMenuItems(): HTMLElement[] {
    return Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('.profile-menu [role="menuitem"], .profile-menu [role="menuitemradio"]'));
  }

  onSearch(value: string): void {
    this.searchService.set(value);
    this.searchError.set('');

    if (this.searchDebounceId) {
      clearTimeout(this.searchDebounceId);
    }

    const term = value.trim();

    if (term.length < 2) {
      this.searchRequestId++;
      this.searchSubscription?.unsubscribe();
      this.searchSubscription = null;
      this.searchResults.set([]);
      this.isSearchLoading.set(false);
      this.isSearchPanelOpen.set(false);
      return;
    }

    // BLG-BUG-007: qualquer mudança de termo invalida e cancela a busca anterior,
    // para que o painel nunca exiba resultado de um termo que não é o atual.
    this.searchRequestId++;
    this.searchSubscription?.unsubscribe();
    this.searchSubscription = null;
    this.searchResults.set([]);
    this.isSearchPanelOpen.set(true);
    this.isSearchLoading.set(true);

    this.searchDebounceId = setTimeout(() => {
      this.runGlobalSearch(term);
    }, 260);
  }

  onSearchFocus(): void {
    if (this.searchTerm().trim().length >= 2) {
      this.isSearchPanelOpen.set(true);
    }
  }

  clearSearch(): void {
    if (this.searchDebounceId) {
      clearTimeout(this.searchDebounceId);
      this.searchDebounceId = null;
    }

    this.searchRequestId++;
    this.searchSubscription?.unsubscribe();
    this.searchSubscription = null;
    this.searchService.clear();
    this.searchResults.set([]);
    this.searchError.set('');
    this.isSearchLoading.set(false);
    this.isSearchPanelOpen.set(false);
  }

  selectSearchResult(result: EventSearchResponse): void {
    this.clearSearch();
    this.closeProfileMenu();

    this.router.navigate(['/calendar'], {
      queryParams: {
        eventId: result.id,
        calendarId: result.calendarId,
        date: result.startsAt.slice(0, 10),
        focus: Date.now(),
      },
    });
  }

  searchResultTitle(result: EventSearchResponse): string {
    if (result.externalSource === 'GOOGLE_ICS') return result.title;
    return result.clientName || result.personName || result.title;
  }

  searchResultSubtitle(result: EventSearchResponse): string {
    return `${this.eventTypeLabel(result.eventType)} - ${result.calendarName}`;
  }

  formatSearchResultDate(value: string): string {
    return new Date(value).toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  }

  ngOnInit(): void {
    this.refreshAccess();

    // Fecha o menu lateral (mobile) e atualiza o contador a cada navegação.
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.closeSidebar();
        this.closeProfileMenu();
        this.refreshAccess();
      });
  }

  private refreshAccess(): void {
    const requestId = ++this.accessRequestId;
    this.accessSubscription?.unsubscribe();
    this.pendingCountSubscription?.unsubscribe();
    this.financeAccessResolved.set(false);
    this.financeCalendars.set([]);
    this.pendingApprovalCount.set(0);
    this.accessSubscription = this.authService.loadCurrentUser().pipe(
      switchMap(user => user && this.currentUser()
        ? this.calendarService.list().pipe(catchError(() => of([])))
        : of([])),
      finalize(() => {
        if (requestId === this.accessRequestId) this.financeAccessResolved.set(true);
      }),
    ).subscribe(calendars => {
      if (requestId !== this.accessRequestId) return;
      this.financeCalendars.set(calendars);
      this.financeAccessResolved.set(true);
      this.refreshPendingApprovalCount();
    });
  }

  private refreshPendingApprovalCount(): void {
    const email = this.currentUser()?.email?.toLowerCase();

    if (!email || !this.canApprove()) {
      this.pendingApprovalCount.set(0);
      return;
    }

    this.pendingCountSubscription?.unsubscribe();
    this.pendingCountSubscription = this.eventService.listPendingApprovals().subscribe({
      next: events => this.pendingApprovalCount.set(
        events.filter(event => canRespondToApproval(event, email)).length,
      ),
      // Falha no contador não deve quebrar o shell; o badge apenas some.
      error: () => this.pendingApprovalCount.set(0),
    });
  }

  ngOnDestroy(): void {
    if (this.searchDebounceId) {
      clearTimeout(this.searchDebounceId);
    }

    this.searchSubscription?.unsubscribe();
    this.pendingCountSubscription?.unsubscribe();
    this.accessSubscription?.unsubscribe();
  }

  logout(): void {
    this.authService.logout();
  }

  private runGlobalSearch(term: string): void {
    const requestId = ++this.searchRequestId;

    this.searchSubscription?.unsubscribe();
    this.searchSubscription = this.eventService.search(term).subscribe({
      next: results => {
        if (requestId !== this.searchRequestId) {
          return;
        }

        this.searchResults.set(results);
        this.searchError.set('');
        this.isSearchLoading.set(false);
      },
      error: () => {
        if (requestId !== this.searchRequestId) {
          return;
        }

        this.searchResults.set([]);
        this.searchError.set('Não foi possível buscar eventos agora.');
        this.isSearchLoading.set(false);
      },
    });
  }

  private eventTypeLabel(eventType: EventType): string {
    const labels: Record<EventType, string> = {
      CLIENT: 'Cliente',
      PERSONAL: 'Pessoal',
      SHARED: 'Compartilhado',
    };

    return labels[eventType];
  }
}
