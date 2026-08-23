import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

const API_PATH = /^\/api(?:\/|$)/;

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const authService = inject(AuthService);
  const apiPath = sameOriginApiPath(request.url);

  if (!apiPath || isPublicApiPath(apiPath)) {
    return next(request);
  }

  const token = authService.getToken();
  const authenticatedRequest = token && !request.headers.has('Authorization')
    ? request.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`,
        },
      })
    : request;

  return next(authenticatedRequest).pipe(
    catchError(error => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        authService.handleUnauthorized();
      }

      return throwError(() => error);
    }),
  );
};

function sameOriginApiPath(url: string): string | null {
  if (url.startsWith('/') && !url.startsWith('//')) {
    const path = url.split(/[?#]/, 1)[0];
    return API_PATH.test(path) ? path : null;
  }

  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const parsedUrl = new URL(url, window.location.origin);
    return parsedUrl.origin === window.location.origin && API_PATH.test(parsedUrl.pathname)
      ? parsedUrl.pathname
      : null;
  } catch {
    return null;
  }
}

function isPublicApiPath(path: string): boolean {
  return path === '/api/auth/login' || path === '/api/health';
}
