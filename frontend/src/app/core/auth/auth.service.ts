import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, of, tap } from 'rxjs';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly tokenKey = 'sharedPlanner.token';
  private readonly apiUrl = '/api';

  readonly currentUserEmail = signal<string | null>(null);

  login(request: LoginRequest) {
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, request).pipe(
      tap(response => this.setToken(response.accessToken)),
    );
  }

  loadCurrentUser() {
    if (!this.isAuthenticated()) {
      this.currentUserEmail.set(null);
      return of(null);
    }

    return this.http
      .get(`${this.apiUrl}/auth/me`, { responseType: 'text' })
      .pipe(
        tap(email => this.currentUserEmail.set(email)),
        catchError(() => {
          this.clearSession();
          return of(null);
        }),
      );
  }

  logout(): void {
    this.clearSession();
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    if (!this.isBrowser()) {
      return null;
    }

    return localStorage.getItem(this.tokenKey);
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  private setToken(token: string): void {
    if (this.isBrowser()) {
      localStorage.setItem(this.tokenKey, token);
    }
  }

  private clearSession(): void {
    this.currentUserEmail.set(null);

    if (this.isBrowser()) {
      localStorage.removeItem(this.tokenKey);
    }
  }

  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }
}
