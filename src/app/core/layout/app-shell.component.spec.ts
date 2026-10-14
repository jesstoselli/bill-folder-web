import { BreakpointObserver } from '@angular/cdk/layout';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom, of } from 'rxjs';
import { AuthSessionService } from '../auth/auth-session.service';
import { SessionEndRedirect } from '../auth/session-end-redirect';
import { APP_ENVIRONMENT } from '../config/app-environment';
import { AppShellComponent } from './app-shell.component';
import { ShellStore } from './shell.store';

@Component({ template: '' })
class RouteStub {}

describe('AppShellComponent', () => {
  let redirect: { toLogin: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    redirect = { toLogin: vi.fn() };
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
        { provide: SessionEndRedirect, useValue: redirect },
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

  it('links the mobile header avatar to Sua conta with the user initial', async () => {
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
    await TestBed.inject(Router).navigateByUrl('/home');

    const fixture = TestBed.createComponent(AppShellComponent);
    TestBed.inject(ShellStore).setMode('drawer');
    fixture.detectChanges();

    const avatar = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>(
      '.shell__account',
    );
    expect(avatar?.getAttribute('href')).toBe('/conta');
    expect(avatar?.getAttribute('aria-label')).toBe('Sua conta');
    expect(avatar?.textContent?.trim()).toBe('J');
  });
});
