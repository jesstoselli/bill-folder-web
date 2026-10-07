import {
  HttpContextToken,
  HttpErrorResponse,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { APP_ENVIRONMENT } from '../config/app-environment';
import { safeInternalReturnUrl } from './auth.guard';
import { AuthSessionService } from './auth-session.service';

const AUTH_RETRY_ATTEMPTED = new HttpContextToken<boolean>(() => false);

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const environment = inject(APP_ENVIRONMENT);
  if (!isApiRequest(request.url, environment.apiBaseUrl) || isPublicAuthRequest(request.url)) {
    return next(request);
  }

  const session = inject(AuthSessionService);
  const router = inject(Router);
  const authenticatedRequest = withBearer(request, session.accessToken());

  return next(authenticatedRequest).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }

      if (request.context.get(AUTH_RETRY_ATTEMPTED)) {
        expireSession(session, router);
        return throwError(() => error);
      }

      return session.refreshOnce().pipe(
        switchMap(() => {
          const retry = withBearer(
            request.clone({ context: request.context.set(AUTH_RETRY_ATTEMPTED, true) }),
            session.accessToken(),
          );
          return next(retry);
        }),
        catchError((refreshOrRetryError: unknown) => {
          expireSession(session, router);
          return throwError(() => refreshOrRetryError);
        }),
      );
    }),
  );
};

function withBearer(request: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  return token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request;
}

function isApiRequest(url: string, apiBaseUrl: string): boolean {
  const normalizedBase = apiBaseUrl.replace(/\/$/, '');
  return url === normalizedBase || url.startsWith(`${normalizedBase}/`);
}

function isPublicAuthRequest(url: string): boolean {
  return /\/auth\/(?:web\/(?:signup|login|refresh|logout)|forgot-password|reset-password)(?:[/?#]|$)/.test(
    url,
  );
}

function expireSession(session: AuthSessionService, router: Router): void {
  const returnUrl = safeInternalReturnUrl(router.url);
  session.clear();
  void router.navigate(['/login'], {
    queryParams: returnUrl && !returnUrl.startsWith('/login') ? { returnUrl } : undefined,
  });
}
