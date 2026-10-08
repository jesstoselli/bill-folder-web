import { BreakpointObserver } from '@angular/cdk/layout';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom, of } from 'rxjs';
import { AuthSessionService } from '../auth/auth-session.service';
import { APP_ENVIRONMENT } from '../config/app-environment';
import { AppShellComponent } from './app-shell.component';
import { ShellStore } from './shell.store';

@Component({ template: '' })
class RouteStub {}

describe('AppShellComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppShellComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'home', component: RouteStub },
          { path: 'login', component: RouteStub },
        ]),
        { provide: APP_ENVIRONMENT, useValue: { apiBaseUrl: '/v1', production: false } },
        {
          provide: BreakpointObserver,
          useValue: {
            observe: () =>
              of({
                matches: true,
                breakpoints: {
                  '(min-width: 1200px)': true,
                  '(min-width: 768px) and (max-width: 1199.98px)': false,
                  '(max-width: 767.98px)': false,
                },
              }),
          },
        },
      ],
    }).compileComponents();
  });

  it('keeps the primary navigation beside the routed content', () => {
    const fixture = TestBed.createComponent(AppShellComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('app-sidebar')).not.toBeNull();
    expect(root.querySelector('main router-outlet')).not.toBeNull();
  });

  it('exposes the drawer state on the mobile menu control', () => {
    const fixture = TestBed.createComponent(AppShellComponent);
    const store = TestBed.inject(ShellStore);
    store.setMode('drawer');
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const menuButton = root.querySelector<HTMLButtonElement>(
      '[aria-controls="primary-navigation"]',
    );

    expect(menuButton?.getAttribute('aria-expanded')).toBe('false');

    menuButton?.click();
    fixture.detectChanges();

    expect(menuButton?.getAttribute('aria-expanded')).toBe('true');
  });

  it('closes the drawer, clears the session and routes to login when remote logout fails', async () => {
    const session = TestBed.inject(AuthSessionService);
    const backend = TestBed.inject(HttpTestingController);
    const login = firstValueFrom(
      session.login({ email: 'jess@example.com', password: 'senha-segura' }),
    );
    backend.expectOne('/v1/auth/web/login').flush({
      accessToken: 'access-token',
      accessTokenExpiresAt: '2026-10-07T18:00:00Z',
      user: { id: 'user-1', email: 'jess@example.com', displayName: 'Jess' },
    });
    await login;

    const router = TestBed.inject(Router);
    await router.navigateByUrl('/home');

    const fixture = TestBed.createComponent(AppShellComponent);
    const store = TestBed.inject(ShellStore);
    store.setMode('drawer');
    store.openDrawer();
    fixture.detectChanges();

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('button[aria-label="Sair"]')
      ?.click();
    const logoutRequest = backend.expectOne('/v1/auth/web/logout');
    await fixture.whenStable();

    expect(router.url).toBe('/home');
    expect(session.isAuthenticated()).toBe(false);

    logoutRequest.flush({ message: 'offline' }, { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();

    expect(session.isAuthenticated()).toBe(false);
    expect(store.drawerOpen()).toBe(false);
    expect(router.url).toBe('/login');
  });
});
