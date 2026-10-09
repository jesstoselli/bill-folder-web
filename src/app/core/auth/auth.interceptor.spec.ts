import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { APP_ENVIRONMENT } from '../config/app-environment';
import { AuthSessionService } from './auth-session.service';
import { authInterceptor } from './auth.interceptor';
import { SessionEndRedirect } from './session-end-redirect';

@Component({ template: '' })
class RouteStub {}

const authResponse = {
  accessToken: 'fresh-access-token',
  accessTokenExpiresAt: '2026-10-07T18:00:00Z',
  user: { id: 'user-1', email: 'jess@example.com', displayName: 'Jess' },
};

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let session: AuthSessionService;
  let router: Router;
  let redirect: { toLogin: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    redirect = { toLogin: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'home', component: RouteStub },
          { path: 'login', component: RouteStub },
        ]),
        { provide: APP_ENVIRONMENT, useValue: { apiBaseUrl: '/v1', production: false } },
        { provide: SessionEndRedirect, useValue: redirect },
      ],
    });

    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    session = TestBed.inject(AuthSessionService);
    router = TestBed.inject(Router);
  });

  afterEach(() => backend.verify());

  it('attaches the in-memory bearer token to protected API calls', async () => {
    const login = firstValueFrom(
      session.login({ email: 'jess@example.com', password: 'senha-segura' }),
    );
    backend.expectOne('/v1/auth/web/login').flush(authResponse);
    await login;

    const result = firstValueFrom(http.get('/v1/home'));
    const request = backend.expectOne('/v1/home');

    expect(request.request.headers.get('Authorization')).toBe('Bearer fresh-access-token');
    request.flush({ ok: true });
    await result;
  });

  it('shares one refresh across concurrent 401 responses', async () => {
    const a = firstValueFrom(http.get('/v1/a'));
    const b = firstValueFrom(http.get('/v1/b'));
    backend.expectOne('/v1/a').flush(null, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne('/v1/b').flush(null, { status: 401, statusText: 'Unauthorized' });

    backend.expectOne('/v1/auth/web/refresh').flush(authResponse);

    const retriedA = backend.expectOne('/v1/a');
    const retriedB = backend.expectOne('/v1/b');
    expect(retriedA.request.headers.get('Authorization')).toBe('Bearer fresh-access-token');
    expect(retriedB.request.headers.get('Authorization')).toBe('Bearer fresh-access-token');
    retriedA.flush({ ok: 'a' });
    retriedB.flush({ ok: 'b' });

    await expect(Promise.all([a, b])).resolves.toEqual([{ ok: 'a' }, { ok: 'b' }]);
  });

  it('retries each request at most once and clears the session after a second 401', async () => {
    await router.navigateByUrl('/home');
    const result = firstValueFrom(http.get('/v1/private'));
    backend.expectOne('/v1/private').flush(null, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne('/v1/auth/web/refresh').flush(authResponse);
    backend.expectOne('/v1/private').flush(null, { status: 401, statusText: 'Unauthorized' });

    await expect(result).rejects.toMatchObject({ status: 401 });
    backend.expectNone('/v1/auth/web/refresh');
    expect(session.isAuthenticated()).toBe(false);
    expect(redirect.toLogin).toHaveBeenCalledWith('/home');
  });

  it('ends the session with a reload when the refresh cookie is rejected', async () => {
    await router.navigateByUrl('/home');
    const result = firstValueFrom(http.get('/v1/private'));
    backend.expectOne('/v1/private').flush(null, { status: 401, statusText: 'Unauthorized' });
    backend
      .expectOne('/v1/auth/web/refresh')
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    await expect(result).rejects.toMatchObject({ status: 401 });
    expect(session.isAuthenticated()).toBe(false);
    expect(redirect.toLogin).toHaveBeenCalledWith('/home');
  });

  it.each([
    [0, 'Unknown Error'],
    [503, 'Service Unavailable'],
  ])('keeps the session when refresh fails transiently (%i)', async (status, statusText) => {
    const login = firstValueFrom(
      session.login({ email: 'jess@example.com', password: 'senha-segura' }),
    );
    backend.expectOne('/v1/auth/web/login').flush(authResponse);
    await login;
    await router.navigateByUrl('/home');

    const result = firstValueFrom(http.get('/v1/private'));
    backend.expectOne('/v1/private').flush(null, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne('/v1/auth/web/refresh').flush(null, { status, statusText });

    await expect(result).rejects.toMatchObject({ status });
    expect(session.isAuthenticated()).toBe(true);
    expect(redirect.toLogin).not.toHaveBeenCalled();
    expect(router.url).toBe('/home');
  });

  it('propagates a non-401 retry failure without clearing the session or route', async () => {
    await router.navigateByUrl('/home');
    const result = firstValueFrom(http.get('/v1/private'));
    backend.expectOne('/v1/private').flush(null, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne('/v1/auth/web/refresh').flush(authResponse);
    backend
      .expectOne('/v1/private')
      .flush(null, { status: 500, statusText: 'Internal Server Error' });

    await expect(result).rejects.toMatchObject({ status: 500 });
    await Promise.resolve();
    expect(session.isAuthenticated()).toBe(true);
    expect(router.url).toBe('/home');
  });

  it('does not intercept or recursively refresh public auth endpoints', async () => {
    const result = firstValueFrom(
      session.login({ email: 'jess@example.com', password: 'wrong-password' }),
    );
    const request = backend.expectOne('/v1/auth/web/login');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({ error: 'invalid_credentials' }, { status: 401, statusText: 'Unauthorized' });

    await expect(result).rejects.toMatchObject({ status: 401 });
    backend.expectNone('/v1/auth/web/refresh');
  });
});
