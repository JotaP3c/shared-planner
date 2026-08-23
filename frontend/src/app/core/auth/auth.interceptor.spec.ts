import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AuthService } from './auth.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let client: HttpClient;
  let http: HttpTestingController;
  let authService: {
    getToken: ReturnType<typeof vi.fn>;
    handleUnauthorized: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    authService = {
      getToken: vi.fn(() => 'signed-jwt'),
      handleUnauthorized: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authService },
      ],
    });

    client = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('adds Bearer only to a same-origin /api request', () => {
    client.get('/api/calendars').subscribe();

    const request = http.expectOne('/api/calendars');
    expect(request.request.headers.get('Authorization')).toBe('Bearer signed-jwt');
    request.flush([]);
  });

  it('adds Bearer to an absolute /api URL on the current origin', () => {
    const url = `${window.location.origin}/api/calendars`;
    client.get(url).subscribe();

    const request = http.expectOne(url);
    expect(request.request.headers.get('Authorization')).toBe('Bearer signed-jwt');
    request.flush([]);
  });

  it('never sends the token to an external URL even when its path contains /api', () => {
    client.get('https://external.example/api/calendars').subscribe();

    const request = http.expectOne('https://external.example/api/calendars');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush([]);
  });

  it('preserves an Authorization header explicitly supplied by the caller', () => {
    client.get('/api/calendars', {
      headers: { Authorization: 'ApiKey explicit-credential' },
    }).subscribe();

    const request = http.expectOne('/api/calendars');
    expect(request.request.headers.get('Authorization')).toBe('ApiKey explicit-credential');
    request.flush([]);
  });

  it('clears the session through AuthService when a protected API returns 401', () => {
    let receivedStatus = 0;
    client.get('/api/calendars').subscribe({
      error: error => receivedStatus = error.status,
    });

    http.expectOne('/api/calendars').flush(
      { detail: 'Unauthorized' },
      { status: 401, statusText: 'Unauthorized' },
    );

    expect(receivedStatus).toBe(401);
    expect(authService.handleUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('preserves the session and propagates a 403 response', () => {
    let receivedStatus = 0;
    client.get('/api/finance/summary').subscribe({
      error: error => receivedStatus = error.status,
    });

    http.expectOne('/api/finance/summary').flush(
      { detail: 'Forbidden' },
      { status: 403, statusText: 'Forbidden' },
    );

    expect(receivedStatus).toBe(403);
    expect(authService.handleUnauthorized).not.toHaveBeenCalled();
  });

  it('preserves the session when the protected API returns 500', () => {
    let receivedStatus = 0;
    client.get('/api/calendars').subscribe({
      error: error => receivedStatus = error.status,
    });

    http.expectOne('/api/calendars').flush(
      { detail: 'Internal error' },
      { status: 500, statusText: 'Internal Server Error' },
    );

    expect(receivedStatus).toBe(500);
    expect(authService.handleUnauthorized).not.toHaveBeenCalled();
  });
});
