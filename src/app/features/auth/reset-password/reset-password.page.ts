import { Component, DestroyRef, ElementRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthApi } from '../../../core/auth/auth.api';
import { authErrorMessage } from '../auth-form-errors';

@Component({
  selector: 'app-reset-password-page',
  imports: [ReactiveFormsModule, RouterLink, MatButtonModule, MatFormFieldModule, MatInputModule],
  templateUrl: './reset-password.page.html',
  styleUrl: './reset-password.page.scss',
})
export class ResetPasswordPage {
  private readonly api = inject(AuthApi);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  readonly email = inject(ActivatedRoute).snapshot.queryParamMap.get('email')?.trim() ?? '';
  readonly emailControl = new FormControl(this.email, {
    nonNullable: true,
    validators: [Validators.required, Validators.email, Validators.maxLength(255)],
  });
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly form = new FormGroup({
    code: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\d{6}$/)],
    }),
    newPassword: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(8), Validators.maxLength(128)],
    }),
  });

  submit(): void {
    if (this.submitting()) {
      return;
    }

    if (this.emailControl.invalid || this.form.invalid) {
      this.emailControl.markAsTouched();
      this.form.markAllAsTouched();
      if (this.emailControl.invalid) {
        return;
      }
      this.focusFirstInvalidField();
      return;
    }

    this.errorMessage.set(null);
    this.submitting.set(true);
    this.api
      .resetPassword({ email: this.emailControl.getRawValue(), ...this.form.getRawValue() })
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => void this.router.navigateByUrl('/login'),
        error: (error: unknown) => {
          this.errorMessage.set(
            authErrorMessage(error, 'Não foi possível redefinir a senha. Tente novamente.'),
          );
        },
      });
  }

  private focusFirstInvalidField(): void {
    const id = this.form.controls.code.invalid ? '#reset-code' : '#reset-password';
    this.host.nativeElement.querySelector<HTMLInputElement>(id)?.focus();
  }
}
