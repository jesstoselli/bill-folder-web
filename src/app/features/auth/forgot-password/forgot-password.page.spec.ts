import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { APP_ENVIRONMENT } from '../../../core/config/app-environment';
import { ForgotPasswordPage } from './forgot-password.page';

@Component({ template: '' })
class RouteStub {}

describe('ForgotPasswordPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ForgotPasswordPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'redefinir-senha', component: RouteStub }]),
        { provide: APP_ENVIRONMENT, useValue: { apiBaseUrl: '/v1', production: false } },
      ],
    }).compileComponents();
  });

  it('provides the global skip link with a focusable main target', () => {
    const fixture = TestBed.createComponent(ForgotPasswordPage);
    fixture.detectChanges();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('main#main-content[tabindex="-1"]'),
    ).not.toBeNull();
  });

  it('validates the email with the same required, format and length rules as the backend', () => {
    const fixture = TestBed.createComponent(ForgotPasswordPage);
    const email = fixture.componentInstance.form.controls.email;

    email.setValue('');
    expect(email.hasError('required')).toBe(true);
    email.setValue('invalid');
    expect(email.hasError('email')).toBe(true);
    email.setValue(`${'a'.repeat(247)}@mail.com`);
    expect(email.hasError('maxlength')).toBe(true);
  });

  it('navigates to reset with the submitted email and never exposes a development code', async () => {
    const fixture = TestBed.createComponent(ForgotPasswordPage);
    fixture.detectChanges();
    fixture.componentInstance.form.setValue({ email: 'Jess+Bills@example.com' });

    fixture.componentInstance.submit();
    fixture.componentInstance.submit();
    const request = TestBed.inject(HttpTestingController).expectOne('/v1/auth/forgot-password');
    expect(request.request.body).toEqual({ email: 'Jess+Bills@example.com' });
    request.flush({ devCode: '123456' });
    await fixture.whenStable();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    const router = TestBed.inject(Router);
    expect(router.parseUrl(router.url).queryParams['email']).toBe('Jess+Bills@example.com');
    expect(text).not.toContain('123456');
  });

  it('keeps duplicate submissions blocked until reset navigation finishes', async () => {
    const fixture = TestBed.createComponent(ForgotPasswordPage);
    fixture.componentInstance.form.setValue({ email: 'jess@example.com' });
    const router = TestBed.inject(Router);
    let finishNavigation!: (navigated: boolean) => void;
    vi.spyOn(router, 'navigate').mockReturnValue(
      new Promise<boolean>((resolve) => {
        finishNavigation = resolve;
      }),
    );

    fixture.componentInstance.submit();
    TestBed.inject(HttpTestingController)
      .expectOne('/v1/auth/forgot-password')
      .flush({ devCode: null });

    expect(fixture.componentInstance.submitting()).toBe(true);
    fixture.componentInstance.submit();
    TestBed.inject(HttpTestingController).expectNone('/v1/auth/forgot-password');

    finishNavigation(true);
    await fixture.whenStable();
    expect(fixture.componentInstance.submitting()).toBe(false);
  });

  it('reports when the reset page cannot be opened and unlocks the form', async () => {
    const fixture = TestBed.createComponent(ForgotPasswordPage);
    fixture.componentInstance.form.setValue({ email: 'jess@example.com' });
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(false);

    fixture.componentInstance.submit();
    TestBed.inject(HttpTestingController)
      .expectOne('/v1/auth/forgot-password')
      .flush({ devCode: null });
    await fixture.whenStable();
    fixture.detectChanges();

    const alert = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      '[role="alert"]',
    );
    expect(alert?.textContent).toContain(
      'Não foi possível abrir a próxima etapa. Tente novamente.',
    );
    expect(fixture.componentInstance.submitting()).toBe(false);
  });

  it('stays on the form and shows an actionable message when sending fails', () => {
    const fixture = TestBed.createComponent(ForgotPasswordPage);
    fixture.detectChanges();
    fixture.componentInstance.form.setValue({ email: 'jess@example.com' });

    fixture.componentInstance.submit();
    TestBed.inject(HttpTestingController)
      .expectOne('/v1/auth/forgot-password')
      .error(new ProgressEvent('error'));
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const alert = root.querySelector<HTMLElement>('[role="alert"]');
    const submit = root.querySelector<HTMLButtonElement>('button[type="submit"]');
    expect(TestBed.inject(Router).url).toBe('/');
    expect(alert?.textContent).toContain('Não foi possível enviar o código. Tente novamente.');
    expect(submit?.disabled).toBe(false);
  });

  it('cancels an in-flight request when the page is destroyed', () => {
    const fixture = TestBed.createComponent(ForgotPasswordPage);
    fixture.componentInstance.form.setValue({ email: 'jess@example.com' });

    fixture.componentInstance.submit();
    const request = TestBed.inject(HttpTestingController).expectOne('/v1/auth/forgot-password');
    fixture.destroy();

    expect(request.cancelled).toBe(true);
  });
});
