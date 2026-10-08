import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { APP_ENVIRONMENT } from '../config/app-environment';
import { AuthSessionService } from './auth-session.service';
import { authInterceptor } from './auth.interceptor';

@Component({ template: '' })
class RouteStub {}

const apiBaseUrl = 'https://api.billfolder.test/v1/';
const authResponse = {
  accessToken: 'origin-scoped-token',
  accessTokenExpiresAt: '2026-10-07T18:00:00Z',
  user: { id: 'user-1', email: 'jess@example.com', displayName: 'Jess' },
};

describe('authInterceptor URL classification', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let session: AuthSessionService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([{ path: 'login', component: RouteStub }]),
        { provide: APP_ENVIRONMENT, useValue: { apiBaseUrl, production: false } },
      ],
    });

    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    session = TestBed.inject(AuthSessionService);
  });

  afterEach(() => backend.verify());

  async function authenticate(): Promise<void> {
    const login = firstValueFrom(
      session.login({ email: 'jess@example.com', password: 'senha-segura' }),
    );
    backend.expectOne('https://api.billfolder.test/v1/auth/web/login').flush(authResponse);
    await login;
  }

  it.each([
    'https://api.billfolder.test/v1/reports?next=/auth/web/login',
    'https://api.billfolder.test/v1/private/auth/web/login/audit',
  ])(
    'keeps protected API URLs protected even when they contain an auth substring: %s',
    async (url) => {
      await authenticate();

      const result = firstValueFrom(http.get(url));
      const request = backend.expectOne(url);
      expect(request.request.headers.get('Authorization')).toBe('Bearer origin-scoped-token');
      request.flush({ ok: true });
      await result;
    },
  );

  it('matches the API base pathname case-insensitively like the backend', async () => {
    await authenticate();
    const url = 'https://api.billfolder.test/V1/private';

    const result = firstValueFrom(http.get(url));
    const request = backend.expectOne(url);
    expect(request.request.headers.get('Authorization')).toBe('Bearer origin-scoped-token');
    request.flush({ ok: true });
    await result;
  });

  it.each([
    '/AUTH/WEB/SIGNUP',
    '/Auth/Web/Login',
    '/auth/web/REFRESH',
    '/auth/WEB/logout',
    '/AUTH/forgot-password',
    '/auth/RESET-password',
  ])('recognizes only an exact public auth pathname case-insensitively: %s', async (path) => {
    await authenticate();
    const url = `https://api.billfolder.test/v1${path}`;

    const result = firstValueFrom(http.post(url, null));
    const request = backend.expectOne(url);
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({ ok: true });
    await result;
  });

  it.each([
    'https://api.billfolder.test.evil/v1/home',
    'https://elsewhere.test/v1/home',
    'https://api.billfolder.test/v10/home',
  ])(
    'never attaches bearer outside the exact API origin and base-path boundary: %s',
    async (url) => {
      await authenticate();

      const result = firstValueFrom(http.get(url));
      const request = backend.expectOne(url);
      expect(request.request.headers.has('Authorization')).toBe(false);
      request.flush({ ok: true });
      await result;
    },
  );
});
