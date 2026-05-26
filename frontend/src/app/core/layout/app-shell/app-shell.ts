import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { SearchService } from '../../api/search.service';

@Component({
  selector: 'app-app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
})
export class AppShell implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly searchService = inject(SearchService);

  readonly currentUser = this.authService.currentUser;
  readonly searchTerm = this.searchService.term;

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
  }

  ngOnInit(): void {
    this.authService.loadCurrentUser().subscribe();
  }

  logout(): void {
    this.authService.logout();
  }
}
