import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthSessionService } from './auth-session.service';

export function safeInternalReturnUrl(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return null;
  }

  return value;
}

export const authGuard: CanActivateFn = (_route, state) => {
  const session = inject(AuthSessionService);
  if (session.isAuthenticated()) {
    return true;
  }

  return inject(Router).createUrlTree(['/login'], {
    queryParams: { returnUrl: safeInternalReturnUrl(state.url) ?? '/home' },
  });
};

export const anonymousGuard: CanActivateFn = () => {
  const session = inject(AuthSessionService);
  return session.isAuthenticated() ? inject(Router).createUrlTree(['/home']) : true;
};
