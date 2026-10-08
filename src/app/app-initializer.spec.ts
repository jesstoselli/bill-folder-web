import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideAppInitializer, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { App } from './app';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { AuthSessionService } from './core/auth/auth-session.service';
import { APP_ENVIRONMENT } from './core/config/app-environment';

describe('auth application initializer', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideAppInitializer(() => firstValueFrom(inject(AuthSessionService).restore())),
        { provide: APP_ENVIRONMENT, useValue: { apiBaseUrl: '/v1', production: false } },
      ],
    }).compileComponents();
  });

  it.each([
    ['network failure', 0, 'Unknown Error'],
    ['service unavailable', 503, 'Service Unavailable'],
  ])('still mounts /login after a restore %s', async (_, status, statusText) => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    const navigation = router.navigateByUrl('/login');
    const request = TestBed.inject(HttpTestingController).expectOne('/v1/auth/web/refresh');

    if (status === 0) {
      request.error(new ProgressEvent('error'), { status, statusText });
    } else {
      request.flush({ error: 'unavailable' }, { status, statusText });
    }

    await navigation;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(router.url).toBe('/login');
    expect((fixture.nativeElement as HTMLElement).querySelector('app-login-page')).not.toBeNull();
  });
});
