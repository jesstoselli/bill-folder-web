import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { APP_ENVIRONMENT } from '../../../core/config/app-environment';
import { SignupPage } from './signup.page';

@Component({ template: '' })
class RouteStub {}

describe('SignupPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SignupPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'home', component: RouteStub }]),
        { provide: APP_ENVIRONMENT, useValue: { apiBaseUrl: '/v1', production: false } },
      ],
    }).compileComponents();
  });

  it('provides the global skip link with a focusable main target', () => {
    const fixture = TestBed.createComponent(SignupPage);
    fixture.detectChanges();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('main#main-content[tabindex="-1"]'),
    ).not.toBeNull();
  });

  it('mirrors the backend name, email and password limits', () => {
    const fixture = TestBed.createComponent(SignupPage);
    const form = fixture.componentInstance.form;

    form.setValue({ displayName: 'J', email: 'not-an-email', password: 'short' });

    expect(form.controls.displayName.hasError('minlength')).toBe(true);
    expect(form.controls.email.hasError('email')).toBe(true);
    expect(form.controls.password.hasError('minlength')).toBe(true);

    form.setValue({
      displayName: 'J'.repeat(101),
      email: `${'a'.repeat(247)}@mail.com`,
      password: 'x'.repeat(129),
    });
    expect(form.controls.displayName.hasError('maxlength')).toBe(true);
    expect(form.controls.email.hasError('maxlength')).toBe(true);
    expect(form.controls.password.hasError('maxlength')).toBe(true);
  });

  it('creates an account, establishes the session and routes home', async () => {
    const fixture = TestBed.createComponent(SignupPage);
    fixture.componentInstance.form.setValue({
      displayName: 'Jessica',
      email: 'jess@example.com',
      password: 'senha-segura',
    });

    fixture.componentInstance.submit();
    const request = TestBed.inject(HttpTestingController).expectOne('/v1/auth/web/signup');
    expect(request.request.body).toEqual({
      displayName: 'Jessica',
      email: 'jess@example.com',
      password: 'senha-segura',
    });
    request.flush({
      accessToken: 'signup-token',
      accessTokenExpiresAt: '2026-10-07T18:00:00Z',
      user: { id: 'user-1', email: 'jess@example.com', displayName: 'Jessica' },
    });
    await fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/home');
  });
});
