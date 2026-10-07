import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';
import { APP_ENVIRONMENT } from '../config/app-environment';
import { AuthApi } from './auth.api';

describe('AuthApi', () => {
  let api: AuthApi;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_ENVIRONMENT, useValue: { apiBaseUrl: '/v1', production: false } },
      ],
    });

    api = TestBed.inject(AuthApi);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it.each([
    ['login', () => api.login({ email: 'jess@example.com', password: 'senha-segura' })],
    [
      'signup',
      () =>
        api.signup({
          displayName: 'Jess',
          email: 'jess@example.com',
          password: 'senha-segura',
        }),
    ],
    ['refresh', () => api.refresh()],
    ['logout', () => api.logout()],
  ] as const)('sends %s through web auth with credentials', (operation, call) => {
    (call() as Observable<unknown>).subscribe();

    const request = backend.expectOne(`/v1/auth/web/${operation}`);

    expect(request.request.method).toBe('POST');
    expect(request.request.withCredentials).toBe(true);
    request.flush(operation === 'logout' ? null : {});
  });

  it('keeps password recovery on the public non-cookie endpoints', () => {
    api.forgotPassword({ email: 'jess@example.com' }).subscribe();
    api
      .resetPassword({ email: 'jess@example.com', code: '123456', newPassword: 'nova-senha' })
      .subscribe();

    expect(backend.expectOne('/v1/auth/forgot-password').request.withCredentials).toBe(false);
    expect(backend.expectOne('/v1/auth/reset-password').request.withCredentials).toBe(false);
  });
});
