import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { APP_ENVIRONMENT } from '../config/app-environment';
import { AuthSessionService } from './auth-session.service';

const authResponse = {
  accessToken: 'access-token-only-in-memory',
  accessTokenExpiresAt: '2026-10-07T18:00:00Z',
  user: { id: 'user-1', email: 'jess@example.com', displayName: 'Jess' },
};

describe('AuthSessionService', () => {
  let session: AuthSessionService;
  let backend: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_ENVIRONMENT, useValue: { apiBaseUrl: '/v1', production: false } },
      ],
    });

    session = TestBed.inject(AuthSessionService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('keeps tokens in memory and restores through cookie refresh', async () => {
    const restored = firstValueFrom(session.restore());
    const request = backend.expectOne('/v1/auth/web/refresh');

    expect(request.request.withCredentials).toBe(true);
    request.flush(authResponse);
    await restored;

    expect(session.isAuthenticated()).toBe(true);
    expect(session.user()).toEqual(authResponse.user);
    expect(session.accessToken()).toBe(authResponse.accessToken);
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('treats a restore 401 as an anonymous session without rejecting bootstrap', async () => {
    const restored = firstValueFrom(session.restore());
    backend
      .expectOne('/v1/auth/web/refresh')
      .flush({ error: 'invalid_refresh_token' }, { status: 401, statusText: 'Unauthorized' });

    await expect(restored).resolves.toBeUndefined();
    expect(session.isAuthenticated()).toBe(false);
  });

  it('treats a restore network failure as anonymous without rejecting bootstrap', async () => {
    const restored = firstValueFrom(session.restore());
    backend
      .expectOne('/v1/auth/web/refresh')
      .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

    await expect(restored).resolves.toBeUndefined();
    expect(session.isAuthenticated()).toBe(false);
  });

  it('treats a restore 503 as anonymous without rejecting bootstrap', async () => {
    const restored = firstValueFrom(session.restore());
    backend
      .expectOne('/v1/auth/web/refresh')
      .flush({ error: 'unavailable' }, { status: 503, statusText: 'Service Unavailable' });

    await expect(restored).resolves.toBeUndefined();
    expect(session.isAuthenticated()).toBe(false);
  });

  it('establishes the session after login and signup', async () => {
    const login = firstValueFrom(
      session.login({ email: 'jess@example.com', password: 'senha-segura' }),
    );
    backend.expectOne('/v1/auth/web/login').flush(authResponse);
    await login;
    expect(session.user()?.displayName).toBe('Jess');

    const signup = firstValueFrom(
      session.signup({
        displayName: 'Jessica',
        email: 'jessica@example.com',
        password: 'senha-segura',
      }),
    );
    backend.expectOne('/v1/auth/web/signup').flush({
      ...authResponse,
      user: { ...authResponse.user, displayName: 'Jessica', email: 'jessica@example.com' },
    });
    await signup;

    expect(session.user()?.displayName).toBe('Jessica');
  });

  it('clears the local session even when remote logout fails', async () => {
    const login = firstValueFrom(
      session.login({ email: 'jess@example.com', password: 'senha-segura' }),
    );
    backend.expectOne('/v1/auth/web/login').flush(authResponse);
    await login;

    const logout = firstValueFrom(session.logout());
    backend
      .expectOne('/v1/auth/web/logout')
      .flush({ message: 'offline' }, { status: 503, statusText: 'Unavailable' });

    await expect(logout).resolves.toBeUndefined();
    expect(session.isAuthenticated()).toBe(false);
    expect(session.accessToken()).toBeNull();
  });

  it('waits for an in-flight refresh and sends remote logout as the last cookie mutation', async () => {
    const login = firstValueFrom(
      session.login({ email: 'jess@example.com', password: 'senha-segura' }),
    );
    backend.expectOne('/v1/auth/web/login').flush(authResponse);
    await login;

    const refresh = firstValueFrom(session.refreshOnce());
    const refreshRequest = backend.expectOne('/v1/auth/web/refresh');
    const logout = firstValueFrom(session.logout());

    expect(session.isAuthenticated()).toBe(false);
    backend.expectNone('/v1/auth/web/logout');

    const blockedRefresh = firstValueFrom(session.refreshOnce());
    backend.expectNone('/v1/auth/web/refresh');

    refreshRequest.flush({ ...authResponse, accessToken: 'late-token' });
    await expect(blockedRefresh).rejects.toThrow('logout');
    const logoutRequest = backend.expectOne('/v1/auth/web/logout');
    logoutRequest.flush(null);
    await Promise.all([refresh, logout]);

    expect(session.isAuthenticated()).toBe(false);
    expect(session.accessToken()).toBeNull();

    const restored = firstValueFrom(session.restore());
    backend
      .expectOne('/v1/auth/web/refresh')
      .flush({ error: 'logged_out' }, { status: 401, statusText: 'Unauthorized' });
    await restored;

    expect(session.isAuthenticated()).toBe(false);
  });

  it('waits for a pending logout before starting login', async () => {
    const logout = firstValueFrom(session.logout());
    const logoutRequest = backend.expectOne('/v1/auth/web/logout');
    const login = firstValueFrom(
      session.login({ email: 'jess@example.com', password: 'senha-segura' }),
    );

    backend.expectNone('/v1/auth/web/login');
    logoutRequest.flush(null);

    backend.expectOne('/v1/auth/web/login').flush(authResponse);
    await Promise.all([logout, login]);

    expect(session.isAuthenticated()).toBe(true);
  });

  it('waits for a pending logout before starting signup', async () => {
    const logout = firstValueFrom(session.logout());
    const logoutRequest = backend.expectOne('/v1/auth/web/logout');
    const signup = firstValueFrom(
      session.signup({
        displayName: 'Jessica',
        email: 'jessica@example.com',
        password: 'senha-segura',
      }),
    );

    backend.expectNone('/v1/auth/web/signup');
    logoutRequest.flush(null);

    backend.expectOne('/v1/auth/web/signup').flush(authResponse);
    await Promise.all([logout, signup]);

    expect(session.isAuthenticated()).toBe(true);
  });
});
