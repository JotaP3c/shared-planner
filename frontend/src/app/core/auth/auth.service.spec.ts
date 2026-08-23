import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;
  let router: { url: string; navigate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    localStorage.clear();
    router = {
      url: '/calendar',
      navigate: vi.fn(() => Promise.resolve(true)),
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: Router, useValue: router },
      ],
    });

    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('preserves the existing session when loading the user fails with a non-401 error', () => {
    localStorage.setItem('sharedPlanner.token', 'still-valid-until-proven-otherwise');
    const existingUser = {
      id: 'user',
      fullName: 'Existing User',
      email: 'existing@example.com',
      role: 'USER' as const,
      active: true,
      createdAt: '',
      updatedAt: '',
    };
    service.currentUser.set(existingUser);
    let result: unknown = 'pending';

    service.loadCurrentUser().subscribe(value => result = value);
    http.expectOne('/api/auth/me').flush(
      { detail: 'Unavailable' },
      { status: 500, statusText: 'Internal Server Error' },
    );

    expect(result).toBeNull();
    expect(service.getToken()).toBe('still-valid-until-proven-otherwise');
    expect(service.currentUser()).toEqual(existingUser);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('clears and redirects only once for concurrent unauthorized responses', () => {
    localStorage.setItem('sharedPlanner.token', 'expired-token');
    service.currentUser.set({
      id: 'user',
      fullName: 'Existing User',
      email: 'existing@example.com',
      role: 'USER',
      active: true,
      createdAt: '',
      updatedAt: '',
    });

    service.handleUnauthorized();
    service.handleUnauthorized();

    expect(service.getToken()).toBeNull();
    expect(service.currentUser()).toBeNull();
    expect(router.navigate).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
});
