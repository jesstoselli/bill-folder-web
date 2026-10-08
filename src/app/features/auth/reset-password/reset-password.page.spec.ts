import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { APP_ENVIRONMENT } from '../../../core/config/app-environment';
import { ResetPasswordPage } from './reset-password.page';

@Component({ template: '' })
class RouteStub {}

describe('ResetPasswordPage', () => {
  let routeEmail: string | null;

  beforeEach(async () => {
    routeEmail = 'jess@example.com';
    await TestBed.configureTestingModule({
      imports: [ResetPasswordPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'login', component: RouteStub }]),
        {
          provide: ActivatedRoute,
          useFactory: () => ({
            snapshot: {
              queryParamMap: convertToParamMap(routeEmail === null ? {} : { email: routeEmail }),
            },
          }),
        },
        { provide: APP_ENVIRONMENT, useValue: { apiBaseUrl: '/v1', production: false } },
      ],
    }).compileComponents();
  });

  it('provides the global skip link with a focusable main target', () => {
    const fixture = TestBed.createComponent(ResetPasswordPage);
    fixture.detectChanges();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('main#main-content[tabindex="-1"]'),
    ).not.toBeNull();
  });

  it('requires six numeric digits and the backend password limits', () => {
    const fixture = TestBed.createComponent(ResetPasswordPage);
    const form = fixture.componentInstance.form;

    form.setValue({ code: '12a456', newPassword: 'short' });
    expect(form.controls.code.hasError('pattern')).toBe(true);
    expect(form.controls.newPassword.hasError('minlength')).toBe(true);

    form.setValue({ code: '123456', newPassword: 'x'.repeat(129) });
    expect(form.controls.code.valid).toBe(true);
    expect(form.controls.newPassword.hasError('maxlength')).toBe(true);
  });

  it.each([
    ['absent', null],
    ['malformed', 'not-an-email'],
    ['too long', `${'a'.repeat(247)}@mail.com`],
  ])('disables reset and explains how to recover when query email is %s', (_, email) => {
    routeEmail = email;
    const fixture = TestBed.createComponent(ResetPasswordPage);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const submit = root.querySelector<HTMLButtonElement>('button[type="submit"]');
    const guidance = root.querySelector<HTMLElement>('#reset-email-guidance[role="alert"]');

    expect(fixture.componentInstance.emailControl.invalid).toBe(true);
    expect(submit?.disabled).toBe(true);
    expect(guidance?.textContent).toContain('Solicite outro código');
  });

  it('accepts a valid query email and enables reset when the form is valid', () => {
    const fixture = TestBed.createComponent(ResetPasswordPage);
    fixture.componentInstance.form.setValue({
      code: '123456',
      newPassword: 'nova-senha-segura',
    });
    fixture.detectChanges();

    expect(fixture.componentInstance.emailControl.valid).toBe(true);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
        'button[type="submit"]',
      )?.disabled,
    ).toBe(false);
  });

  it('submits the email, code and new password then returns to login', async () => {
    const fixture = TestBed.createComponent(ResetPasswordPage);
    fixture.componentInstance.form.setValue({
      code: '123456',
      newPassword: 'nova-senha-segura',
    });

    fixture.componentInstance.submit();
    fixture.componentInstance.submit();
    const request = TestBed.inject(HttpTestingController).expectOne('/v1/auth/reset-password');
    expect(request.request.body).toEqual({
      email: 'jess@example.com',
      code: '123456',
      newPassword: 'nova-senha-segura',
    });
    request.flush(null);
    await fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/login');
  });

  it('cancels an in-flight reset when the page is destroyed', () => {
    const fixture = TestBed.createComponent(ResetPasswordPage);
    fixture.componentInstance.form.setValue({
      code: '123456',
      newPassword: 'nova-senha-segura',
    });

    fixture.componentInstance.submit();
    const request = TestBed.inject(HttpTestingController).expectOne('/v1/auth/reset-password');
    fixture.destroy();

    expect(request.cancelled).toBe(true);
  });
});
