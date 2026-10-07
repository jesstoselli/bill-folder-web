import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { APP_ENVIRONMENT } from '../../../core/config/app-environment';
import { ForgotPasswordPage } from './forgot-password.page';

describe('ForgotPasswordPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ForgotPasswordPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
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

  it('always shows the same generic confirmation and never exposes a development code', () => {
    const fixture = TestBed.createComponent(ForgotPasswordPage);
    fixture.detectChanges();
    fixture.componentInstance.form.setValue({ email: 'jess@example.com' });

    fixture.componentInstance.submit();
    TestBed.inject(HttpTestingController)
      .expectOne('/v1/auth/forgot-password')
      .flush({ devCode: '123456' });
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Se existir uma conta com esse email, enviaremos as instruções.');
    expect(text).not.toContain('123456');
  });
});
