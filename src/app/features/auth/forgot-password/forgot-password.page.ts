import { Component, DestroyRef, ElementRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Router, RouterLink } from '@angular/router';
import { catchError, EMPTY, finalize, from, of, switchMap, tap } from 'rxjs';
import { AuthApi } from '../../../core/auth/auth.api';

const SEND_ERROR = 'Não foi possível enviar o código. Tente novamente.';
const NAVIGATION_ERROR = 'Não foi possível abrir a próxima etapa. Tente novamente.';

@Component({
  selector: 'app-forgot-password-page',
  imports: [ReactiveFormsModule, RouterLink, MatButtonModule, MatFormFieldModule, MatInputModule],
  templateUrl: './forgot-password.page.html',
  styleUrl: './forgot-password.page.scss',
})
export class ForgotPasswordPage {
  private readonly api = inject(AuthApi);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email, Validators.maxLength(255)],
    }),
  });

  submit(): void {
    if (this.submitting()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.host.nativeElement.querySelector<HTMLInputElement>('#forgot-email')?.focus();
      return;
    }

    const request = this.form.getRawValue();
    this.errorMessage.set(null);
    this.submitting.set(true);
    this.api
      .forgotPassword(request)
      .pipe(
        switchMap(() =>
          from(
            this.router.navigate(['/redefinir-senha'], {
              queryParams: { email: request.email },
            }),
          ).pipe(catchError(() => of(false))),
        ),
        tap((navigated) => {
          if (!navigated) {
            this.errorMessage.set(NAVIGATION_ERROR);
          }
        }),
        catchError(() => {
          this.errorMessage.set(SEND_ERROR);
          return EMPTY;
        }),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.submitting.set(false)),
      )
      .subscribe();
  }
}
