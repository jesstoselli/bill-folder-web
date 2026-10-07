import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { AuthSessionService } from './auth-session.service';
import { anonymousGuard, authGuard } from './auth.guard';

describe('auth guards', () => {
  const session = {
    isAuthenticated: () => false,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthSessionService, useValue: session }],
    });
  });

  it('redirects anonymous users to login with a safe internal return URL', () => {
    session.isAuthenticated = () => false;

    const result = TestBed.runInInjectionContext(() =>
      authGuard(
        {} as ActivatedRouteSnapshot,
        { url: '/despesas?status=abertas' } as RouterStateSnapshot,
      ),
    );

    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe(
      '/login?returnUrl=%2Fdespesas%3Fstatus%3Dabertas',
    );
  });

  it('allows authenticated users into private routes', () => {
    session.isAuthenticated = () => true;

    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url: '/home' } as RouterStateSnapshot),
    );

    expect(result).toBe(true);
  });

  it('never preserves an external return URL', () => {
    session.isAuthenticated = () => false;

    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url: '//evil.example' } as RouterStateSnapshot),
    );

    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/login?returnUrl=%2Fhome');
  });

  it('keeps authenticated users out of public auth pages', () => {
    session.isAuthenticated = () => true;

    const result = TestBed.runInInjectionContext(() =>
      anonymousGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );

    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/home');
  });
});
