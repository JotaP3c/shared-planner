import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, of, tap } from 'rxjs';
import { UserResponse } from '../models/shared-planner.models';

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

  readonly currentUser = signal<UserResponse | null>(null);

  login(request: LoginRequest) {
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, request).pipe(
      tap(response => this.setToken(response.accessToken)),
    );
  }

  loadCurrentUser() {
    if (!this.isAuthenticated()) {
      this.currentUser.set(null);
      return of(null);
    }

    return this.http.get<unknown>(`${this.apiUrl}/auth/me`).pipe(
      tap(response => this.currentUser.set(this.normalizeUser(response))),
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
    if (!this.isBrowser()) return null;
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
    this.currentUser.set(null);
    if (this.isBrowser()) {
      localStorage.removeItem(this.tokenKey);
    }
  }

  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  private normalizeUser(response: unknown): UserResponse | null {
    if (!response) {
      return null;
    }

    if (typeof response === 'string') {
      return {
        id: '',
        fullName: response.split('@')[0] || 'User',
        email: response,
        role: 'USER',
        active: true,
        createdAt: '',
        updatedAt: '',
      };
    }

    const user = response as Partial<UserResponse>;

    if (!user.email) {
      return null;
    }

    return {
      id: user.id ?? '',
      fullName: user.fullName?.trim() || user.email.split('@')[0] || 'User',
      email: user.email,
      role: user.role ?? 'USER',
      active: user.active ?? true,
      createdAt: user.createdAt ?? '',
      updatedAt: user.updatedAt ?? '',
    };
  }
}
