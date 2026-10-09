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
import { SessionEndRedirect } from './session-end-redirect';

const AUTH_RETRY_ATTEMPTED = new HttpContextToken<boolean>(() => false);
const PUBLIC_AUTH_PATHS = new Set([
  '/auth/web/signup',
  '/auth/web/login',
  '/auth/web/refresh',
  '/auth/web/logout',
  '/auth/forgot-password',
  '/auth/reset-password',
]);

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const environment = inject(APP_ENVIRONMENT);
  const apiUrl = resolveApiUrl(request.url, environment.apiBaseUrl);
  if (!apiUrl || isPublicAuthRequest(apiUrl.request, apiUrl.basePathname)) {
    return next(request);
  }

  const session = inject(AuthSessionService);
  const router = inject(Router);
  const redirect = inject(SessionEndRedirect);
  const authenticatedRequest = withBearer(request, session.accessToken());

  return next(authenticatedRequest).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }

      if (request.context.get(AUTH_RETRY_ATTEMPTED)) {
        expireSession(session, router, redirect);
        return throwError(() => error);
      }

      return session.refreshOnce().pipe(
        catchError((refreshError: unknown) => {
          expireSession(session, router, redirect);
          return throwError(() => refreshError);
        }),
        switchMap(() => {
          const retry = withBearer(
            request.clone({ context: request.context.set(AUTH_RETRY_ATTEMPTED, true) }),
            session.accessToken(),
          );
          return next(retry).pipe(
            catchError((retryError: unknown) => {
              if (retryError instanceof HttpErrorResponse && retryError.status === 401) {
                expireSession(session, router, redirect);
              }
              return throwError(() => retryError);
            }),
          );
        }),
      );
    }),
  );
};

function withBearer(request: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  return token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request;
}

function resolveApiUrl(
  requestUrl: string,
  apiBaseUrl: string,
): { request: URL; basePathname: string } | null {
  try {
    const currentOrigin = globalThis.location.origin;
    const request = new URL(requestUrl, currentOrigin);
    const base = new URL(apiBaseUrl, currentOrigin);
    const basePathname = base.pathname.replace(/\/+$/, '') || '/';
    const comparableRequestPathname = request.pathname.toLowerCase();
    const comparableBasePathname = basePathname.toLowerCase();
    const isWithinBase =
      comparableRequestPathname === comparableBasePathname ||
      comparableRequestPathname.startsWith(
        comparableBasePathname === '/' ? '/' : `${comparableBasePathname}/`,
      );

    return request.origin === base.origin && isWithinBase ? { request, basePathname } : null;
  } catch {
    return null;
  }
}

function isPublicAuthRequest(request: URL, basePathname: string): boolean {
  const relativePathname =
    basePathname === '/' ? request.pathname : request.pathname.slice(basePathname.length);
  return PUBLIC_AUTH_PATHS.has(relativePathname.toLowerCase());
}

function expireSession(
  session: AuthSessionService,
  router: Router,
  redirect: SessionEndRedirect,
): void {
  const returnUrl = safeInternalReturnUrl(router.url);
  session.clear();
  redirect.toLogin(returnUrl);
}
