import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { catchError, finalize, of, switchMap } from 'rxjs';
import { CalendarService } from '../../api/calendar.service';
import { EventService } from '../../api/event.service';
import { AuthService } from '../../auth/auth.service';
import { SearchService } from '../../api/search.service';
import { CalendarResponse, EventSearchResponse, EventType } from '../../models/shared-planner.models';

@Component({
  selector: 'app-app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
})
export class AppShell implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly calendarService = inject(CalendarService);
  private readonly searchService = inject(SearchService);
  private readonly eventService = inject(EventService);
  private readonly router = inject(Router);
  private searchDebounceId: ReturnType<typeof setTimeout> | null = null;
  private searchRequestId = 0;

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

  readonly isAdmin = computed(() => this.currentUser()?.role === 'ADMIN');
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

    if (user.role === 'ADMIN') {
      return true;
    }

    if (user.role === 'FINANCE') {
      return this.financeCalendars().some(calendar => calendar.memberRole !== null);
    }

    return this.financeCalendars().some(calendar =>
      calendar.memberRole === 'ADMIN' || calendar.memberRole === 'FINANCE',
    );
  });

  readonly openNavGroups = signal<Set<string>>(new Set(['admin']));
  readonly showProfileMenu = signal(false);

  toggleNavGroup(group: string): void {
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
  }

  closeProfileMenu(): void {
    this.showProfileMenu.set(false);
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
      this.searchResults.set([]);
      this.isSearchLoading.set(false);
      this.isSearchPanelOpen.set(false);
      return;
    }

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
    this.financeAccessResolved.set(false);
    this.authService
      .loadCurrentUser()
      .pipe(
        switchMap(user => user
          ? this.calendarService.list().pipe(catchError(() => of([])))
          : of([])),
        finalize(() => this.financeAccessResolved.set(true)),
      )
      .subscribe(calendars => this.financeCalendars.set(calendars));
  }

  ngOnDestroy(): void {
    if (this.searchDebounceId) {
      clearTimeout(this.searchDebounceId);
    }
  }

  logout(): void {
    this.authService.logout();
  }

  private runGlobalSearch(term: string): void {
    const requestId = ++this.searchRequestId;

    this.eventService.search(term).subscribe({
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
        this.searchError.set('Nao foi possivel buscar eventos agora.');
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
