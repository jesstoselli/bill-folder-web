import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { APP_ENVIRONMENT } from '../../../core/config/app-environment';
import { LoginPage } from './login.page';

@Component({ template: '' })
class RouteStub {}

const authResponse = {
  accessToken: 'login-token',
  accessTokenExpiresAt: '2026-10-07T18:00:00Z',
  user: { id: 'user-1', email: 'jess@example.com', displayName: 'Jess' },
};

describe('LoginPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'home', component: RouteStub },
          { path: 'despesas', component: RouteStub },
        ]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({ returnUrl: '/despesas' }) } },
        },
        { provide: APP_ENVIRONMENT, useValue: { apiBaseUrl: '/v1', production: false } },
      ],
    }).compileComponents();
  });

  it('provides the global skip link with a focusable main target', () => {
    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('main#main-content[tabindex="-1"]'),
    ).not.toBeNull();
  });

  it('announces validation errors and focuses the first invalid field', () => {
    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();

    fixture.componentInstance.submit();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('[role="alert"]').length).toBeGreaterThan(0);
    expect((document.activeElement as HTMLElement | null)?.id).toBe('login-email');
  });

  it('establishes the session and returns to a safe internal route', async () => {
    const fixture = TestBed.createComponent(LoginPage);
    fixture.componentInstance.form.setValue({
      email: 'jess@example.com',
      password: 'senha-segura',
    });

    fixture.componentInstance.submit();
    fixture.componentInstance.submit();
    const request = TestBed.inject(HttpTestingController).expectOne('/v1/auth/web/login');
    expect(request.request.body).toEqual({
      email: 'jess@example.com',
      password: 'senha-segura',
    });
    request.flush(authResponse);
    await fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/despesas');
  });

  it('cancels an in-flight login when the page is destroyed', () => {
    const fixture = TestBed.createComponent(LoginPage);
    fixture.componentInstance.form.setValue({
      email: 'jess@example.com',
      password: 'senha-segura',
    });

    fixture.componentInstance.submit();
    const request = TestBed.inject(HttpTestingController).expectOne('/v1/auth/web/login');
    fixture.destroy();

    expect(request.cancelled).toBe(true);
  });
});
