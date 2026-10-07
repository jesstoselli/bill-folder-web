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
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResetPasswordPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'login', component: RouteStub }]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap({ email: 'jess@example.com' }) },
          },
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

  it('requires the email query parameter, six numeric digits and the backend password limits', () => {
    const fixture = TestBed.createComponent(ResetPasswordPage);
    const form = fixture.componentInstance.form;

    expect(fixture.componentInstance.email).toBe('jess@example.com');
    form.setValue({ code: '12a456', newPassword: 'short' });
    expect(form.controls.code.hasError('pattern')).toBe(true);
    expect(form.controls.newPassword.hasError('minlength')).toBe(true);

    form.setValue({ code: '123456', newPassword: 'x'.repeat(129) });
    expect(form.controls.code.valid).toBe(true);
    expect(form.controls.newPassword.hasError('maxlength')).toBe(true);
  });

  it('submits the email, code and new password then returns to login', async () => {
    const fixture = TestBed.createComponent(ResetPasswordPage);
    fixture.componentInstance.form.setValue({
      code: '123456',
      newPassword: 'nova-senha-segura',
    });

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
});
