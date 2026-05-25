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
    const parts = user.fullName.trim().split(' ');
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  });

  readonly isAdmin = computed(() => this.currentUser()?.role === 'ADMIN');

  readonly openNavGroup = signal<string | null>('admin');
  readonly showProfileMenu = signal(false);

  toggleNavGroup(group: string): void {
    this.openNavGroup.set(this.openNavGroup() === group ? null : group);
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
