import { Component, computed, inject, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
})
export class AppShell implements OnInit {
  private readonly authService = inject(AuthService);

  readonly userEmail = this.authService.currentUserEmail;

  readonly userInitials = computed(() => {
    const email = this.userEmail();

    if (!email) {
      return 'SP';
    }

    return email.slice(0, 2).toUpperCase();
  });

  ngOnInit(): void {
    this.authService.loadCurrentUser().subscribe();
  }

  logout(): void {
    this.authService.logout();
  }
}
